import type { ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import type { ResolvedConfig } from './config.ts';
import type { SiteSet } from './render.ts';

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { createServer } from 'vite';

import { loadConfig } from './config.ts';
import { coalesce, runGenerators } from './generate.ts';
import { llmsFullTxt, llmsTxt, servedMarkdown } from './llms.ts';
import { formatDiagnostic } from './markdown/index.ts';
import { siteAssets } from './pages.ts';
import { isInside } from './paths.ts';
import { assetUrl, createRenderer, iconLinks, renderDocument } from './render.ts';
import { scanSites } from './versions.ts';
import { generatedFiles, ssrRunner, viteConfig, writeGeneratedFiles } from './vite.ts';

const MIME: Record<string, string> = {
	'.avif': 'image/avif',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.jpeg': 'image/jpeg',
	'.jpg': 'image/jpeg',
	'.json': 'application/json',
	'.mp4': 'video/mp4',
	'.pdf': 'application/pdf',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain; charset=utf-8',
	'.webm': 'video/webm',
	'.webp': 'image/webp'
};

function send(res: ServerResponse, status: number, type: string, body: string | Buffer) {
	res.statusCode = status;
	res.setHeader('Content-Type', type);
	res.end(body);
}

function docsPlugin(config: ResolvedConfig): Plugin {
	return {
		name: 'svelte-edda:dev',
		configureServer(server: ViteDevServer) {
			const renderer = createRenderer(ssrRunner(server), config, 'dev');
			const files = generatedFiles(config);
			// `transformIndexHtml` would prefix `base` to every root-relative URL on the page, including
			// links that already have it, so the Vite client is added by hand instead.
			const assets = {
				styles: [assetUrl(config, 'dev', files.css)],
				scripts: [`${config.base}@vite/client`, assetUrl(config, 'dev', files.client)],
				icons: iconLinks(config)
			};

			// Pages render on every request, so any change only needs a reload. The list of pages is
			// kept until a file in the docs directory changes: scanning reads every page of every
			// version, too much to repeat for each image on a page.
			let scanned: Promise<SiteSet> | undefined;
			const scan = () => {
				const current = (scanned ??= scanSites(config));
				// A failed scan is retried: the cause may be outside the watched files, like a git tag.
				current.catch(() => {
					if (scanned === current) scanned = undefined;
				});
				return current;
			};
			server.watcher.add(config.docsDir);

			// A generator runs again when a file it watches changes; writing its pages into the docs
			// directory then reloads the browser like any edit there.
			const regenerate = config.generate
				.filter((generator) => generator.watch.length > 0)
				.map((generator) => {
					server.watcher.add(generator.watch);
					const trigger = coalesce(async () => {
						for (const diagnostic of await runGenerators(config, 'write', [generator])) {
							server.config.logger.error(formatDiagnostic(diagnostic));
						}
					});
					return { generator, trigger };
				});
			server.watcher.on('all', (_event, file) => {
				for (const { generator, trigger } of regenerate) {
					if (generator.watch.some((path) => isInside(path, file))) trigger();
				}
			});
			server.watcher.on('all', (_event, file) => {
				const isDoc = isInside(config.docsDir, file);
				if (isDoc) scanned = undefined;
				const isRendered =
					(server.environments.ssr.moduleGraph.getModulesByFile(file)?.size ?? 0) > 0;
				if (isDoc || isRendered) server.environments.client.hot.send({ type: 'full-reload' });
			});

			const respond = async (pathname: string, res: ServerResponse): Promise<boolean> => {
				const sites = await scan();
				const all = [sites.current, ...sites.archived];
				if (pathname === `${config.base}llms.txt`) {
					send(res, 200, MIME['.txt']!, await llmsTxt(config, sites.current));
					return true;
				}
				if (pathname === `${config.base}llms-full.txt`) {
					send(res, 200, MIME['.txt']!, await llmsFullTxt(config, sites.current));
					return true;
				}

				for (const site of all) {
					const markdown = site.pages.find((page) => page.markdownUrl === pathname);
					if (markdown) {
						send(res, 200, 'text/markdown; charset=utf-8', await servedMarkdown(site, markdown));
						return true;
					}
					const page = site.byUrl.get(pathname);
					if (page) {
						const rendered = await renderer.renderPage(sites, site, page);
						for (const diagnostic of rendered.diagnostics) {
							server.config.logger.warn(formatDiagnostic(diagnostic));
						}
						send(res, 200, 'text/html; charset=utf-8', renderDocument(config, rendered, assets));
						return true;
					}
					if (site.byUrl.has(`${pathname}/`)) {
						res.statusCode = 302;
						res.setHeader('Location', `${pathname}/`);
						res.end();
						return true;
					}
					const asset = (await siteAssets(site)).get(pathname);
					if (asset) {
						send(
							res,
							200,
							MIME[extname(asset).toLowerCase()] ?? 'application/octet-stream',
							await readFile(asset)
						);
						return true;
					}
				}

				const notFound = renderDocument(config, await renderer.renderNotFound(sites), assets);
				send(res, 404, 'text/html; charset=utf-8', notFound);
				return true;
			};

			return () => {
				server.middlewares.use(async (req, res, next) => {
					try {
						// Vite strips `base` from `req.url`; `originalUrl` keeps the full path.
						const url =
							(req as typeof req & { originalUrl?: string }).originalUrl ?? req.url ?? '/';
						const pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
						if (!pathname.startsWith(config.base) || !(await respond(pathname, res))) next();
					} catch (error) {
						if (error instanceof Error) server.ssrFixStacktrace(error);
						next(error);
					}
				});
			};
		}
	};
}

export async function dev(
	config: ResolvedConfig,
	options: { port?: number; host?: string | boolean }
) {
	// A failing generator leaves its last pages in place; the server starts anyway.
	for (const diagnostic of await runGenerators(config, 'write')) {
		console.error(formatDiagnostic(diagnostic));
	}
	await writeGeneratedFiles(config, 'dev');
	const base = viteConfig(config);
	const server = await createServer({
		...base,
		appType: 'custom',
		plugins: [...(base.plugins ?? []), docsPlugin(config)],
		server: { ...base.server, port: options.port, host: options.host }
	});
	await server.listen();
	server.printUrls();

	// The config shapes the whole server (base, components, theme files), so a change restarts it.
	if (config.configFile) {
		const configFile = config.configFile;
		server.watcher.add(configFile);
		server.watcher.on('change', async (file) => {
			if (file !== configFile) return;
			server.config.logger.info('svelte-edda: config changed, restarting…');
			try {
				const next = await loadConfig(config.root);
				await server.close();
				await dev(next, { port: server.config.server.port, host: options.host });
			} catch (error) {
				server.config.logger.error(`svelte-edda: config error: ${(error as Error).message}`);
			}
		});
	}
	return server;
}
