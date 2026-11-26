import type { ResolvedConfig } from './config.ts';
import type { Diagnostic } from './markdown/index.ts';
import type { Site } from './pages.ts';
import type { SidebarEntry } from './types.ts';

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { runGenerators } from './generate.ts';
import { createTranslator } from './i18n/translator.ts';
import { renderMarkdown } from './markdown/index.ts';
import { ScanError, scanSite } from './pages.ts';
import { toPosix } from './paths.ts';
import { pageLang } from './render.ts';
import { versionCommit } from './versions.ts';

const problem = (file: string, message: string, severity: Diagnostic['severity'] = 'error') => ({
	file,
	message,
	severity
});

/** Language folders only: with `locales` set, anything else at the top of the docs directory is a mistake. */
export async function checkLayout(config: ResolvedConfig): Promise<Diagnostic[]> {
	if (config.locales.length === 0) return [];
	const keys = new Set(config.locales.map((locale) => locale.key));
	const docs = toPosix(relative(config.root, config.docsDir));
	const entries = await readdir(config.docsDir, { withFileTypes: true });
	return entries
		.filter((entry) => !entry.name.startsWith('.') && !entry.name.startsWith('_'))
		.filter((entry) => !(entry.isDirectory() && keys.has(entry.name)))
		.map((entry) =>
			problem(
				`${docs}/${entry.name}`,
				`with \`locales\` set, every top-level entry of ${docs}/ is a language folder (${[...keys].join(', ')}); move it into ${docs}/${config.locales[0]!.key}/`
			)
		);
}

/** Context7 reads one language; translations must be kept out of its index. */
async function checkContext7(config: ResolvedConfig): Promise<Diagnostic[]> {
	const file = join(config.root, 'context7.json');
	if (config.locales.length < 2 || !existsSync(file)) return [];
	const settings = JSON.parse(await readFile(file, 'utf8')) as {
		folders?: string[];
		excludeFolders?: string[];
	};
	const docs = toPosix(relative(config.root, config.docsDir));
	const fallback = `${docs}/${config.locales[0]!.key}`;
	const folders = settings.folders ?? [];
	const restricted =
		folders.length > 0 &&
		folders.every((folder) => folder.replace(/\/+$/, '').startsWith(fallback));
	const excluded = config.locales
		.slice(1)
		.every((locale) =>
			settings.excludeFolders?.some(
				(folder) => folder.replace(/\/+$/, '') === `${docs}/${locale.key}`
			)
		);
	if (restricted || excluded) return [];
	return [
		problem(
			'context7.json',
			`Context7 indexes English only; set "folders": ["${fallback}"] so translations stay out of it`,
			'warning'
		)
	];
}

const configPath = (config: ResolvedConfig) =>
	config.configFile ? toPosix(relative(config.root, config.configFile)) : 'config';

/** Everything that needs absolute URLs disappears without `site`, and nothing else says so. */
function checkSite(config: ResolvedConfig): Diagnostic[] {
	if (config.site) {
		return URL.canParse(config.site) && new URL(config.site).pathname !== '/'
			? [
					problem(
						configPath(config),
						`\`site\` is an origin, without a path: every URL already starts with \`base\`. Set \`site\` to ${new URL(config.site).origin}`,
						'warning'
					)
				]
			: [];
	}
	return [
		problem(
			configPath(config),
			'`site` is not set, so pages get no canonical URL, structured data or absolute og:url and og:image, and the build writes no sitemap.xml or robots.txt; set it to the origin the site is served from',
			'warning'
		)
	];
}

/**
 * `nav` and `sidebar` entries that name no page, and pages a configured sidebar leaves out.
 * Translations mirror the default language, so only that one is checked.
 */
export function checkNavigation(config: ResolvedConfig, site: Site): Diagnostic[] {
	const fallback = site.locales[0]!;
	const docs = toPosix(relative(config.root, fallback.root));
	const missing = fallback.missing.map(({ option, link }) =>
		problem(configPath(config), `\`${option}\` names ${link}, which is not a page in ${docs}/`)
	);
	const untranslated = untranslatedTexts(config);
	if (!config.sidebar) return [...missing, ...untranslated];
	const listed = new Set(fallback.ordered);
	const unlisted = fallback.pages
		.filter((page) => !listed.has(page) && !page.hidden && page.slug !== '')
		.map((page) =>
			problem(
				toPosix(relative(config.root, page.file)),
				`the page is not in \`sidebar\` of ${configPath(config)}; add it there, or set \`sidebar: false\` in its frontmatter to leave it out on purpose`,
				'warning'
			)
		);
	return [...missing, ...untranslated, ...unlisted];
}

/** Menu texts given per language that skip one of the site's languages. */
function untranslatedTexts(config: ResolvedConfig): Diagnostic[] {
	const [first, ...others] = config.locales;
	if (!first || others.length === 0) return [];
	const diagnostics: Diagnostic[] = [];
	const visit = (option: string, entries: SidebarEntry[]) => {
		for (const entry of entries) {
			if (typeof entry === 'string') continue;
			if (typeof entry.text === 'object') {
				const text = entry.text;
				const absent = config.locales.filter((locale) => !(locale.key in text));
				if (absent.length > 0)
					diagnostics.push(
						problem(
							configPath(config),
							`\`${option}\` text "${Object.values(text)[0]}" has no ${absent.map((locale) => `"${locale.key}"`).join(', ')}; ${first.key in text ? `the "${first.key}" text is shown there` : 'the first text is shown there'}`,
							'warning'
						)
					);
			}
			if ('items' in entry) visit(option, entry.items);
		}
	};
	visit('nav', config.nav);
	visit('sidebar', config.sidebar ?? []);
	return diagnostics;
}

async function checkVersions(config: ResolvedConfig): Promise<Diagnostic[]> {
	const results = await Promise.all(
		config.versions.map(async (version) => {
			try {
				await versionCommit(config, version);
				return undefined;
			} catch (error) {
				return problem(configPath(config), (error as Error).message);
			}
		})
	);
	return results.filter((result): result is Diagnostic => result !== undefined);
}

/** Validates the latest version without rendering components: layout, markers, attributes, links. */
export async function check(config: ResolvedConfig): Promise<Diagnostic[]> {
	const generated = await runGenerators(config, 'check');
	const layout = await checkLayout(config);
	if (layout.some((diagnostic) => diagnostic.severity === 'error'))
		return [...generated, ...layout];

	let site;
	try {
		site = await scanSite(config);
	} catch (error) {
		return [
			...generated,
			...layout,
			error instanceof ScanError
				? error.diagnostic
				: problem(toPosix(relative(config.root, config.docsDir)), (error as Error).message)
		];
	}
	const pages = await Promise.all(
		// Untranslated pages render the default language's file, which is checked once already.
		site.pages
			.filter((page) => !page.fallback)
			.map(async (page) => {
				const source = await readFile(page.file, 'utf8');
				const t = createTranslator(pageLang(config, page), config.messages);
				return (await renderMarkdown({ config, site, page, source, t })).diagnostics;
			})
	);
	return [
		...generated,
		...layout,
		...checkSite(config),
		...checkNavigation(config, site),
		...(await checkContext7(config)),
		...(await checkVersions(config)),
		...pages.flat()
	];
}
