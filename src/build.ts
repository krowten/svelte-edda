import type { Manifest } from 'vite';
import type { ResolvedConfig } from './config.ts';
import type { Diagnostic } from './markdown/index.ts';
import type { RenderedPage } from './render.ts';

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import * as pagefind from 'pagefind';
import { build as viteBuild, createServer } from 'vite';

import { checkLayout, checkNavigation } from './check.ts';
import { runGenerators } from './generate.ts';
import { llmsFullTxt, llmsTxt, robotsTxt, servedMarkdown, sitemapXml } from './llms.ts';
import { ScanError, siteAssets } from './pages.ts';
import { toPosix } from './paths.ts';
import { assetName, createRenderer, iconLinks, renderDocument } from './render.ts';
import { scanSites } from './versions.ts';
import { ssrRunner, viteConfig, writeGeneratedFiles } from './vite.ts';

export class BuildError extends Error {
	constructor(readonly diagnostics: Diagnostic[]) {
		const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
		super(`Documentation has ${errors.length} error(s)`);
	}
}

async function write(file: string, content: string | Buffer) {
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, content);
}

export async function build(
	config: ResolvedConfig
): Promise<{ pages: number; warnings: Diagnostic[] }> {
	const generated = await runGenerators(config, 'write');
	if (generated.length > 0) throw new BuildError(generated);
	const sites = await scanSites(config).catch((error: unknown) => {
		throw error instanceof ScanError ? new BuildError([error.diagnostic]) : error;
	});
	const all = [sites.current, ...sites.archived];
	await writeGeneratedFiles(config, 'dev');
	/** Output path of a URL under `base`. */
	const output = (url: string) => join(config.outDir, url.slice(config.base.length));

	// 1. Render every page of every version and language through Vite's SSR runner; this also
	// collects the islands in use.
	const base = viteConfig(config);
	const server = await createServer({
		...base,
		appType: 'custom',
		logLevel: 'warn',
		server: { ...base.server, middlewareMode: true, hmr: false, ws: false }
	});
	const renderer = createRenderer(ssrRunner(server), config, 'build');
	const rendered: { url: string; page: RenderedPage }[] = [];
	let notFound: RenderedPage;
	try {
		for (const site of all) {
			for (const page of site.pages) {
				rendered.push({ url: page.url, page: await renderer.renderPage(sites, site, page) });
			}
		}
		notFound = await renderer.renderNotFound(sites);
	} finally {
		await server.close();
	}

	const diagnostics = [
		...(await checkLayout(config)),
		...checkNavigation(config, sites.current),
		...rendered.flatMap(({ page }) => page.diagnostics)
	];
	const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
	if (errors.length > 0) throw new BuildError(diagnostics);

	// 2. Bundle the client: theme scripts, CSS and only the islands the pages use. Vite also copies
	// `publicDir` into the output here.
	const files = await writeGeneratedFiles(config, 'build', renderer.islands);
	await viteBuild({
		...base,
		logLevel: 'warn',
		build: {
			outDir: config.outDir,
			emptyOutDir: true,
			manifest: true,
			rolldownOptions: { input: { client: files.client, styles: files.css } }
		}
	});
	const manifestFile = join(config.outDir, '.vite', 'manifest.json');
	const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Manifest;
	await rm(join(config.outDir, '.vite'), { recursive: true, force: true });
	const entry = (file: string) => {
		const chunk = manifest[toPosix(relative(config.root, file))];
		if (!chunk) throw new Error(`svelte-edda: ${file} is missing from the build manifest`);
		return chunk;
	};
	const client = entry(files.client);
	const assets = {
		scripts: [config.base + client.file],
		styles: [entry(files.css).file, ...(client.css ?? [])].map((file) => config.base + file),
		icons: iconLinks(config)
	};

	// 3. Pages, their Markdown sources and the files for agents and search engines.
	for (const { url, page } of rendered) {
		await write(join(output(url), 'index.html'), renderDocument(config, page, assets));
	}
	await write(join(config.outDir, '404.html'), renderDocument(config, notFound, assets));
	await write(join(config.outDir, '.nojekyll'), '');
	for (const site of all) {
		for (const page of site.pages)
			await write(output(page.markdownUrl), await servedMarkdown(site, page));
		// Images and other files next to the Markdown.
		for (const [url, file] of await siteAssets(site)) {
			await mkdir(dirname(output(url)), { recursive: true });
			await copyFile(file, output(url));
		}
	}
	await write(join(config.outDir, 'llms.txt'), await llmsTxt(config, sites.current));
	await write(join(config.outDir, 'llms-full.txt'), await llmsFullTxt(config, sites.current));
	const sitemap = sitemapXml(
		config,
		sites.current,
		new Map(rendered.map(({ url, page }) => [url, page.modified]))
	);
	if (sitemap) await write(join(config.outDir, 'sitemap.xml'), sitemap);
	// A robots.txt from publicDir is already in place and wins.
	const robots = robotsTxt(config);
	if (robots && !existsSync(join(config.outDir, 'robots.txt')))
		await write(join(config.outDir, 'robots.txt'), robots);
	for (const logo of [config.logo?.src, config.logo?.dark]) {
		if (!logo || /^(https?:)?\/\/|^data:/.test(logo)) continue;
		await mkdir(join(config.outDir, '_docs'), { recursive: true });
		await copyFile(logo, join(config.outDir, '_docs', assetName(logo)));
	}

	// 4. Search index over the generated HTML: only pages with `data-pagefind-body`, which is the
	// latest version. Pagefind splits the index by `<html lang>`.
	const { index } = await pagefind.createIndex();
	if (!index) throw new Error('svelte-edda: Pagefind failed to start');
	await index.addDirectory({ path: config.outDir });
	const written = await index.writeFiles({ outputPath: join(config.outDir, 'pagefind') });
	await pagefind.close();
	if (written.errors.length > 0) {
		throw new Error(`svelte-edda: Pagefind failed: ${written.errors.join('; ')}`);
	}

	return { pages: rendered.length, warnings: diagnostics };
}
