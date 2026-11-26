import type { ModuleRunner } from 'vite/module-runner';
import type { ResolvedConfig } from './config.ts';
import type { Translate } from './i18n/translator.ts';
import type { ComponentInstance, Diagnostic } from './markdown/index.ts';
import type { LocaleSite, Page, SidebarItem, Site } from './pages.ts';
import type { LayoutLink, LayoutProps } from './theme/types.ts';

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { THEME_KEY } from './client/keys.ts';
import { createTranslator } from './i18n/translator.ts';
import { renderMarkdown } from './markdown/index.ts';
import { localeSiteOf } from './pages.ts';
import { engineSrc, isInside, toPosix } from './paths.ts';
import { structuredData } from './structured-data.ts';
import { lastModified, repositoryRootOf } from './versions.ts';

export type Mode = 'dev' | 'build';

export type RenderedPage = {
	title: string;
	description?: string;
	lang: string;
	dir: 'ltr' | 'rtl';
	url: string;
	/** Where search engines should file the page, when not at its own URL. */
	canonical?: string;
	/** Kept out of search engines: archived versions and the 404 page. */
	noindex: boolean;
	type: 'website' | 'article';
	/** Date of the last commit, `YYYY-MM-DD`. */
	modified?: string;
	/** schema.org objects, written as JSON-LD. */
	structuredData: object[];
	markdownUrl?: string;
	/** `<style>` blocks of the Svelte components on the page, rendered on the server. */
	styles: string[];
	/** Tags from the `head` option. */
	head: string[];
	/** Other languages of the same page, for `hreflang`. */
	alternates: { lang: string; url: string }[];
	/** Interface strings the browser code needs, already in the page's language. */
	clientMessages: Record<string, string>;
	body: string;
	diagnostics: Diagnostic[];
};

/** Every variant of the site, so pages can link to the same page in other versions. */
export type SiteSet = { current: Site; archived: Site[] };

export type Renderer = {
	/** Island name → absolute path of its component. Filled while pages render. */
	islands: Map<string, string>;
	renderPage: (sites: SiteSet, site: Site, page: Page) => Promise<RenderedPage>;
	renderNotFound: (sites: SiteSet) => Promise<RenderedPage>;
};

type SvelteServer = typeof import('svelte/server');
type Svelte = typeof import('svelte');

const escapeAttribute = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/** URL of a local file or asset: served from source in dev, copied under `_docs/` on build. */
export function assetUrl(config: ResolvedConfig, mode: Mode, path: string): string {
	if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
	if (mode === 'dev') return `${config.base}@fs${toPosix(path).replace(/^(?!\/)/, '/')}`;
	return `${config.base}_docs/${assetName(path)}`;
}

export function assetName(path: string): string {
	const hash = createHash('sha256').update(path).digest('hex').slice(0, 8);
	return `${hash}-${path.split(/[\\/]/).at(-1)}`;
}

/** The interface language of a monolingual site, or of a page's language. */
export function pageLang(config: ResolvedConfig, page: Pick<Page, 'locale'> | undefined): string {
	return page?.locale?.lang ?? config.lang;
}

/**
 * The page's file in the repository. A generated page has none worth editing: the next run would
 * overwrite the edit, and the generator's source is out of the engine's sight.
 */
async function sourceEditUrl(
	config: ResolvedConfig,
	page: Page,
	gitRoot: () => Promise<string>
): Promise<string | undefined> {
	if (!config.repository) return undefined;
	if (config.generate.some((generator) => isInside(generator.dir, page.file))) return undefined;
	return `${config.repository}/edit/${config.branch}/${toPosix(relative(await gitRoot(), page.file))}`;
}

/** The same page in another variant or language, or that one's home page when it has no such page. */
function counterpart(target: Site, targetLocale: LocaleSite, from: Site, page: Page): string {
	const fromPrefix = localeSiteOf(from, page).prefix;
	const url = targetLocale.prefix + page.url.slice(fromPrefix.length);
	if (target.byUrl.has(url)) return url;
	// The same file under another URL: a translation or an older version with its own `slug`.
	return targetLocale.byRelative.get(page.relative)?.url ?? targetLocale.prefix;
}

function sameLocale(site: Site, page: Page): LocaleSite {
	return site.locales.find((entry) => entry.locale?.key === page.locale?.key) ?? site.locales[0]!;
}

export function createRenderer(runner: ModuleRunner, config: ResolvedConfig, mode: Mode): Renderer {
	const islands = new Map<string, string>();
	const svelte = () => runner.import<Svelte>('svelte');
	const server = () => runner.import<SvelteServer>('svelte/server');
	const translators = new Map<string, Translate>();
	let repositoryRoot: Promise<string> | undefined;
	// Edit links are relative to the repository, which may keep the docs in a subdirectory.
	const gitRoot = () => (repositoryRoot ??= repositoryRootOf(config.root));
	const translator = (lang: string) => {
		let t = translators.get(lang);
		if (!t) translators.set(lang, (t = createTranslator(lang, config.messages)));
		return t;
	};

	/** Renders a component; its CSS (compiled as `injected` on the server) goes into `styles`. */
	const renderSvelte = async (
		file: string,
		props: Record<string, unknown>,
		childrenHtml: string | undefined,
		styles: Set<string>
	) => {
		const { render } = await server();
		const { createRawSnippet } = await svelte();
		const { default: component } = await runner.import(file);
		// A raw snippet must render a single element, hence the wrapper.
		const children = childrenHtml
			? createRawSnippet(() => ({
					render: () => `<div class="docs-children contents">${childrenHtml}</div>`
				}))
			: undefined;
		const result = render(component, { props: children ? { ...props, children } : props });
		if (result.head) styles.add(result.head);
		return result.body;
	};

	const renderIsland = async (
		name: string,
		file: string,
		props: Record<string, unknown>,
		childrenHtml: string | undefined,
		styles: Set<string>
	): Promise<string> => {
		islands.set(name, file);
		const body = await renderSvelte(file, props, childrenHtml, styles);
		const attributes = [
			`data-name="${escapeAttribute(name)}"`,
			mode === 'dev' ? `data-src="${escapeAttribute(assetUrl(config, 'dev', file))}"` : '',
			`data-props="${escapeAttribute(JSON.stringify(props))}"`,
			childrenHtml ? `data-children="${escapeAttribute(childrenHtml)}"` : ''
		].filter(Boolean);
		return `<docs-island ${attributes.join(' ')}>${body}</docs-island>`;
	};

	const renderComponent = async (
		instance: ComponentInstance,
		styles: Set<string>
	): Promise<string> => {
		if (instance.kind === 'demo') {
			const hash = createHash('sha256').update(instance.source).digest('hex').slice(0, 12);
			const file = join(config.cacheDir, 'demos', `${hash}.svelte`);
			if (!existsSync(file) || (await readFile(file, 'utf8')) !== instance.source) {
				await mkdir(join(config.cacheDir, 'demos'), { recursive: true });
				await writeFile(file, instance.source);
			}
			const island = await renderIsland(`demo-${hash}`, file, {}, undefined, styles);
			return `<div class="not-prose mt-6 mb-6 overflow-hidden rounded border border-base-200 dark:border-base-800" data-demo data-testid="live-demo"><div class="p-6" data-testid="live-demo-preview">${island}</div>${instance.codeHtml}</div>`;
		}

		const { definition, props, childrenHtml } = instance;
		if (definition.interactive)
			return renderIsland(definition.name, definition.component, props, childrenHtml, styles);
		return renderSvelte(definition.component, props, childrenHtml, styles);
	};

	const renderLayout = (styles: Set<string>, props: LayoutProps) =>
		renderSvelte(join(engineSrc, 'theme', 'Layout.svelte'), props, undefined, styles);

	const siteProps = (): LayoutProps['site'] => ({
		title: config.title,
		repository: config.repository,
		logo: config.logo && {
			src: assetUrl(config, mode, config.logo.src),
			dark: config.logo.dark && assetUrl(config, mode, config.logo.dark),
			alt: config.logo.alt
		}
	});

	const clientMessages = (t: Translate) => ({
		copy: t('code.copy'),
		copied: t('code.copied'),
		copyFailed: t('code.copyFailed'),
		// The browser substitutes the query for the marker.
		noResults: t('search.noResults', { query: '\u0000' }),
		searchUnavailable: t('search.unavailable'),
		navOpen: t('nav.open'),
		navClose: t('nav.close')
	});

	const versionLinks = (sites: SiteSet, site: Site, page: Page, t: Translate): LayoutLink[] => {
		if (config.versions.length === 0) return [];
		return [sites.current, ...sites.archived].map((target) => ({
			title: target.variant.version?.label ?? t('version.latest'),
			url: counterpart(target, sameLocale(target, page), site, page),
			current: target === site
		}));
	};

	/** A header link is current on its own page and on the other pages of its top-level sidebar group. */
	const navLinks = (localeSite: LocaleSite, page: Page): LayoutLink[] => {
		const holds = (item: SidebarItem, url: string): boolean =>
			item.url === url || (item.type === 'group' && item.items.some((child) => holds(child, url)));
		const section = (url: string) =>
			localeSite.sidebar.find((item) => item.type === 'group' && holds(item, url));
		const current = section(page.url);
		// One link at most: several may lead into the same group.
		const active =
			localeSite.nav.find((link) => link.url === page.url) ??
			localeSite.nav.find((link) => current !== undefined && section(link.url) === current);
		return localeSite.nav.map((link) => ({ ...link, current: link === active }));
	};

	const languageLinks = (site: Site, page: Page): LayoutLink[] => {
		if (!site.localized) return [];
		return site.locales.map((entry) => ({
			title: entry.locale!.label,
			url: counterpart(site, entry, site, page),
			current: entry.locale?.key === page.locale?.key,
			lang: entry.locale!.lang
		}));
	};

	return {
		islands,
		async renderPage(sites, site, page) {
			const lang = pageLang(config, page);
			const t = translator(lang);
			const localeSite = localeSiteOf(site, page);
			const source = await readFile(page.file, 'utf8');
			const styles = new Set<string>();
			const markdown = await renderMarkdown({
				config,
				site,
				page,
				source,
				t,
				render: (instance) => renderComponent(instance, styles)
			});
			const index = localeSite.ordered.indexOf(page);
			const link = (other: Page | undefined) => other && { title: other.label, url: other.url };
			const archived = site.variant.version;
			const fallbackLocale = site.locales[0]?.locale;
			// An archived page is a file in the cache, outside the repository's history.
			const modified = archived ? undefined : await lastModified(page.file, config.root);
			const absolute = (url: string) => (config.site ?? '') + url;

			const body = await renderLayout(styles, {
				site: siteProps(),
				home: localeSite.prefix,
				sidebar: localeSite.sidebar,
				nav: navLinks(localeSite, page),
				languages: languageLinks(site, page),
				versions: versionLinks(sites, site, page, t),
				archived: archived && {
					label: archived.label,
					latestUrl: counterpart(sites.current, sameLocale(sites.current, page), site, page)
				},
				untranslated:
					page.fallback && fallbackLocale
						? { language: fallbackLocale.label, lang: fallbackLocale.lang }
						: undefined,
				page: {
					url: page.url,
					layout: page.layout,
					title: markdown.titled ? undefined : page.title,
					html: markdown.html,
					headings: markdown.headings,
					markdownUrl: page.markdownUrl,
					editUrl: archived
						? undefined
						: (page.editUrl ?? (await sourceEditUrl(config, page, gitRoot))),
					updated: modified
						? {
								date: modified,
								text: new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(
									new Date(modified)
								)
							}
						: undefined,
					prev: index > 0 ? link(localeSite.ordered[index - 1]) : undefined,
					next: index >= 0 ? link(localeSite.ordered[index + 1]) : undefined,
					// Search covers the latest version only.
					searchable: !archived
				},
				t
			});

			const description =
				page.description ??
				(page.slug ? markdown.summary : (config.description ?? markdown.summary));
			return {
				title: page.documentTitle,
				description,
				lang,
				dir: page.locale?.dir ?? 'ltr',
				url: page.url,
				// An untranslated page repeats the default language's one.
				canonical: page.fallback ? counterpart(site, site.locales[0]!, site, page) : undefined,
				noindex: archived !== undefined,
				type: page.slug ? 'article' : 'website',
				modified,
				// Only the indexed copy of a page describes it; absolute URLs need `site`.
				structuredData:
					config.site && !archived && !page.fallback
						? structuredData({
								origin: config.site,
								siteTitle: config.title,
								home: localeSite.prefix,
								sidebar: localeSite.sidebar,
								page: {
									url: page.url,
									title: page.title,
									description,
									lang,
									modified,
									isHome: page.slug === ''
								}
							})
						: [],
				markdownUrl: page.markdownUrl,
				styles: [...styles],
				head: config.head({
					title: page.documentTitle,
					description,
					url: absolute(page.url),
					lang,
					slug: page.slug,
					lastModified: modified,
					version: archived?.label
				}),
				// A page that names another as canonical must not claim translations of its own.
				alternates:
					site.localized && !page.fallback
						? site.locales
								.map((entry) => entry.pages.find((other) => other.relative === page.relative))
								.filter((other): other is Page => other !== undefined && !other.fallback)
								.map((other) => ({ lang: other.locale!.lang, url: other.url }))
						: [],
				clientMessages: clientMessages(t),
				body,
				diagnostics: page.fallback
					? []
					: archived
						? // A tag cannot be edited, so its problems never fail the build.
							markdown.diagnostics.map((diagnostic) => ({
								...diagnostic,
								message: `${diagnostic.message} (version ${archived.label})`,
								severity: 'warning' as const
							}))
						: markdown.diagnostics
			};
		},
		async renderNotFound(sites) {
			const localeSite = sites.current.locales[0]!;
			const lang = pageLang(config, localeSite.pages[0]);
			const t = translator(lang);
			const styles = new Set<string>();
			const body = await renderLayout(styles, {
				site: siteProps(),
				home: localeSite.prefix,
				sidebar: localeSite.sidebar,
				nav: localeSite.nav,
				languages: [],
				versions: [],
				page: {
					url: '',
					layout: 'docs',
					title: t('notFound.title'),
					html: `<p>${t('notFound.text')} <a href="${localeSite.prefix}">${t('notFound.home')}</a></p>`,
					headings: [],
					searchable: false
				},
				t
			});
			const title = `${t('notFound.title')} | ${config.title}`;
			return {
				title,
				lang,
				dir: localeSite.locale?.dir ?? 'ltr',
				url: '',
				noindex: true,
				type: 'website',
				structuredData: [],
				styles: [...styles],
				head: config.head({
					title,
					url: (config.site ?? '') + config.base + '404.html',
					lang,
					slug: '404'
				}),
				alternates: [],
				clientMessages: clientMessages(t),
				body,
				diagnostics: []
			};
		}
	};
}

export type DocumentAssets = { scripts: string[]; styles: string[]; icons: string[] };

const escape = (value: string) =>
	value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

/** Favicons found in `publicDir`, as `<link>` tags. */
export function iconLinks(config: ResolvedConfig): string[] {
	if (!config.publicDir) return [];
	const icons: [string, string][] = [
		['favicon.svg', '<link rel="icon" type="image/svg+xml" href="%s" />'],
		['favicon.ico', '<link rel="icon" sizes="any" href="%s" />'],
		['favicon.png', '<link rel="icon" type="image/png" href="%s" />'],
		['apple-touch-icon.png', '<link rel="apple-touch-icon" href="%s" />']
	];
	return icons
		.filter(([file]) => existsSync(join(config.publicDir!, file)))
		.map(([file, tag]) => tag.replace('%s', escape(config.base + file)));
}

const rootClass =
	'scroll-pt-20 bg-white text-base-800 antialiased scheme-light dark:bg-base-900 dark:text-base-300 dark:scheme-dark';

export function renderDocument(
	config: ResolvedConfig,
	page: RenderedPage,
	assets: DocumentAssets
): string {
	const absolute = (url: string) => (config.site ? config.site + url : url);
	// Open Graph needs an absolute image URL; a relative one is ignored by every reader.
	const image =
		config.ogImage &&
		(/^(https?:)?\/\//.test(config.ogImage)
			? config.ogImage
			: config.site && config.site + config.base + config.ogImage);
	const canonical =
		config.site && page.url && !page.noindex ? absolute(page.canonical ?? page.url) : undefined;
	const meta = (property: string, content: string | undefined, attribute = 'property') =>
		content ? `<meta ${attribute}="${property}" content="${escape(content)}" />` : '';

	const head = [
		'<meta charset="utf-8" />',
		'<meta name="viewport" content="width=device-width, initial-scale=1" />',
		`<title>${escape(page.title)}</title>`,
		meta('description', page.description, 'name'),
		page.noindex ? '<meta name="robots" content="noindex" />' : '',
		canonical ? `<link rel="canonical" href="${escape(canonical)}" />` : '',
		meta('og:type', page.type),
		meta('og:site_name', config.title),
		meta('og:title', page.title),
		meta('og:description', page.description),
		meta('og:url', canonical),
		meta('og:locale', page.lang.replace('-', '_')),
		...page.alternates
			.filter((alternate) => alternate.lang !== page.lang)
			.map((alternate) => meta('og:locale:alternate', alternate.lang.replace('-', '_'))),
		page.type === 'article' ? meta('article:modified_time', page.modified) : '',
		meta('og:image', image),
		meta('twitter:card', image ? 'summary_large_image' : 'summary', 'name'),
		// The default language comes first and doubles as the choice for every other reader.
		...[
			...page.alternates,
			...page.alternates.slice(0, 1).map((first) => ({ ...first, lang: 'x-default' }))
		].map(
			(alternate) =>
				`<link rel="alternate" hreflang="${escape(alternate.lang)}" href="${escape(absolute(alternate.url))}" />`
		),
		page.markdownUrl
			? `<link rel="alternate" type="text/markdown" href="${escape(page.markdownUrl)}" />`
			: '',
		...page.structuredData.map(
			(data) =>
				`<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`
		),
		...assets.icons,
		`<script>${themeScript}</script>`,
		`<script type="application/json" id="svelte-edda-messages">${JSON.stringify(page.clientMessages).replaceAll('<', '\\u003c')}</script>`,
		...assets.styles.map((href) => `<link rel="stylesheet" href="${escape(href)}" />`),
		...page.styles,
		...assets.scripts.map((src) => `<script type="module" src="${escape(src)}"></script>`),
		...page.head
	].filter(Boolean);
	return `<!doctype html>\n<html lang="${escape(page.lang)}" dir="${page.dir}" class="${rootClass}">\n<head>\n${head.join('\n')}\n</head>\n<body>\n${page.body}\n</body>\n</html>\n`;
}

/** Runs before the first paint: picks the theme and marks that JavaScript is on. */
const themeScript = `(()=>{const d=document.documentElement;d.classList.add('js');let t;try{t=localStorage.getItem('${THEME_KEY}')}catch{}d.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`;
