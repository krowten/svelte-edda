import type { ResolvedConfig, ResolvedLocale, ResolvedVersion } from './config.ts';
import type { Diagnostic } from './markdown/index.ts';
import type { LocalizedText, SidebarEntry } from './types.ts';

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import { YAMLParseError, parse as parseYaml } from 'yaml';

import { toPosix } from './paths.ts';

/** One buildable copy of the docs: the working tree, or an archived version from a git tag. */
export type Variant = {
	docsDir: string;
	/** URL prefix of this copy: `base`, or `base` + `v/<slug>/` for an archived version. */
	base: string;
	version?: ResolvedVersion;
};

export type Page = {
	/** Absolute path to the rendered source: the translation, or the default-language page it falls back to. */
	file: string;
	/** Directory `file` is relative to: the language folder it lives in, or the docs directory. */
	sourceRoot: string;
	/** Path relative to the language folder, with `/` separators; the same across languages. */
	relative: string;
	/** URL path without base, language prefix and slashes: `''` for the home page, `guide/install` otherwise. */
	slug: string;
	url: string;
	markdownUrl: string;
	/** Frontmatter `title`, else the first heading, else a name made from the file name. */
	title: string;
	/** Name in the sidebar and the previous/next links: frontmatter `sidebar`, else the title. */
	label: string;
	/** Left out of the sidebar on purpose: `sidebar: false` in frontmatter. */
	hidden: boolean;
	/** Text of `<title>`. */
	documentTitle: string;
	description?: string;
	/** Frontmatter `editUrl`: where "Edit this page" leads instead of the file in the repository. */
	editUrl?: string;
	/** `landing` drops the sidebar and the table of contents; frontmatter `layout`. */
	layout: 'docs' | 'landing';
	order: number;
	/** `index.md` or `README.md`: the page of its folder. */
	isIndex: boolean;
	/** Undefined when the documentation is in one language. */
	locale?: ResolvedLocale;
	/** Shown in the default language because the page has no translation. */
	fallback: boolean;
};

export type SidebarItem =
	| { type: 'page'; title: string; url: string }
	| { type: 'group'; title: string; url?: string; items: SidebarItem[]; collapsed?: boolean };

export type NavItem = { title: string; url: string };

/** A `nav` or `sidebar` entry of the config that names no page. */
export type MissingLink = { option: 'nav' | 'sidebar'; link: string };

/** The pages of one language within a variant. */
export type LocaleSite = {
	locale?: ResolvedLocale;
	/** Folder of this language's sources. */
	root: string;
	/** URL prefix of this language: the variant base, plus `<key>/` for other than the default language. */
	prefix: string;
	pages: Page[];
	/** Pages in reading order: the sidebar flattened. */
	ordered: Page[];
	sidebar: SidebarItem[];
	/** Header links from the `nav` option. */
	nav: NavItem[];
	/** Config entries that name no page in this language. */
	missing: MissingLink[];
	byRelative: Map<string, Page>;
};

export type Site = {
	variant: Variant;
	/** Whether this variant is laid out by language. An archived version may predate translations. */
	localized: boolean;
	locales: LocaleSite[];
	pages: Page[];
	byUrl: Map<string, Page>;
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const ORDER_PREFIX = /^(\d+)[-_.]/;
const INDEX_NAMES = new Set(['index', 'readme']);

export function splitFrontmatter(source: string): { data: Record<string, unknown>; body: string } {
	const match = FRONTMATTER.exec(source);
	if (!match) return { data: {}, body: source };
	const data = parseYaml(match[1] ?? '');
	return {
		data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
		body: source.slice(match[0].length)
	};
}

/** An author's mistake found while scanning, where no page can be rendered to report it on. */
export class ScanError extends Error {
	constructor(readonly diagnostic: Diagnostic) {
		super(
			`${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}` : ''} ${diagnostic.message}`
		);
	}
}

function frontmatterOf(config: ResolvedConfig, file: string, source: string) {
	try {
		return splitFrontmatter(source);
	} catch (error) {
		if (!(error instanceof YAMLParseError)) throw error;
		const place = error.linePos?.[0];
		throw new ScanError({
			file: toPosix(relative(config.root, file)),
			// The block starts under the opening `---`.
			line: place && place.line + 1,
			column: place?.col,
			message: `Invalid frontmatter: ${error.message.split('\n')[0]!.replace(/ at line \d+, column \d+:?$/, '')}`,
			severity: 'error'
		});
	}
}

/** The first `# Heading` outside code fences. */
export function firstHeading(body: string): string | undefined {
	let fence: string | undefined;
	for (const line of body.split('\n')) {
		const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
		if (marker) {
			if (!fence) fence = marker;
			else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
			continue;
		}
		if (fence) continue;
		const heading = /^#\s+(.+?)\s*#*\s*$/.exec(line);
		if (heading) return heading[1];
	}
	return undefined;
}

export function humanize(segment: string): string {
	const words = segment.replace(/[-_]+/g, ' ').trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function stripOrder(segment: string): string {
	return segment.replace(ORDER_PREFIX, '');
}

/** URL path of a file next to the pages: order prefixes are dropped, like in page URLs. */
export function assetPath(relativePath: string): string {
	return toPosix(relativePath).split('/').map(stripOrder).join('/');
}

function orderOf(segment: string): number {
	const match = ORDER_PREFIX.exec(segment);
	return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

const skipped = (path: string) =>
	path
		.split('/')
		.some((part) => part.startsWith('.') || part.startsWith('_') || part === 'node_modules');

/** Files under `root`, relative and with `/` separators, without hidden and `_` entries. */
export async function listFiles(root: string): Promise<string[]> {
	if (!existsSync(root)) return [];
	const entries = await readdir(root, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => toPosix(relative(root, join(entry.parentPath, entry.name))))
		.filter((path) => !skipped(path))
		.sort();
}

export function currentVariant(config: ResolvedConfig): Variant {
	return { docsDir: config.docsDir, base: config.base };
}

/** Whether a variant's docs directory is laid out in language folders. */
export function isLocalized(config: ResolvedConfig, variant: Variant): boolean {
	const fallback = config.locales[0];
	return fallback !== undefined && existsSync(join(variant.docsDir, fallback.key));
}

async function readPages(
	config: ResolvedConfig,
	root: string,
	prefix: string,
	locale: ResolvedLocale | undefined
): Promise<Page[]> {
	const bySlug = new Map<string, Page>();
	for (const path of (await listFiles(root)).filter((file) => file.endsWith('.md'))) {
		const file = join(root, path);
		const { data, body } = frontmatterOf(config, file, await readFile(file, 'utf8'));
		const segments = path.slice(0, -'.md'.length).split('/');
		const name = stripOrder(segments.at(-1)!).toLowerCase();
		const isIndex = INDEX_NAMES.has(name);
		// Frontmatter `slug` keeps a URL apart from the file's place in the sidebar.
		const slug =
			typeof data.slug === 'string'
				? data.slug.replace(/^\/+|\/+$/g, '')
				: (isIndex ? segments.slice(0, -1) : segments).map(stripOrder).join('/');

		const taken = bySlug.get(slug);
		if (taken) {
			// `index.md` wins over `README.md` in the same folder; anything else is a mistake.
			const sameFolder = taken.isIndex && isIndex && dirname(taken.relative) === dirname(path);
			if (!sameFolder) {
				throw new Error(
					`svelte-edda: ${taken.relative} and ${path} in ${toPosix(relative(config.root, root))}/ are the same page, ${prefix}${slug}/; remove one`
				);
			}
			if (name !== 'index') continue;
		}

		// An index page takes its default order and title from its folder.
		const owner = isIndex ? segments.at(-2) : segments.at(-1);
		const fallbackTitle = owner === undefined ? config.title : humanize(stripOrder(owner));
		const title =
			typeof data.title === 'string' ? data.title : (firstHeading(body) ?? fallbackTitle);
		bySlug.set(slug, {
			file,
			sourceRoot: root,
			relative: path,
			slug,
			url: slug ? `${prefix}${slug}/` : prefix,
			markdownUrl: `${prefix}${slug || 'index'}.md`,
			title,
			label: typeof data.sidebar === 'string' ? data.sidebar : title,
			hidden: data.sidebar === false,
			// The home page is named after the site unless it sets its own title; a title that already
			// names the site does not repeat it.
			documentTitle:
				!slug && typeof data.title !== 'string'
					? config.title
					: title.includes(config.title)
						? title
						: `${title} | ${config.title}`,
			layout: data.layout === 'landing' ? 'landing' : 'docs',
			description: typeof data.description === 'string' ? data.description : undefined,
			editUrl: typeof data.editUrl === 'string' ? data.editUrl : undefined,
			order: typeof data.order === 'number' ? data.order : orderOf(owner ?? ''),
			isIndex,
			locale,
			fallback: false
		});
	}
	return [...bySlug.values()];
}

const isExternal = (link: string) => /^[a-z][a-z\d+.-]*:|^\/\//i.test(link);

function localeSite(
	config: ResolvedConfig,
	variant: Variant,
	locale: ResolvedLocale | undefined,
	root: string,
	prefix: string,
	pages: Page[]
): LocaleSite {
	const byRelative = new Map(pages.map((page) => [page.relative, page]));
	const missing: MissingLink[] = [];
	const text = (value: LocalizedText) =>
		typeof value === 'string'
			? value
			: (value[locale?.key ?? ''] ??
				value[config.locales[0]?.key ?? ''] ??
				Object.values(value)[0] ??
				'');
	const resolve = (option: MissingLink['option'], link: string) => {
		if (isExternal(link)) return link;
		const page = byRelative.get(link.replace(/^\.?\/+/, ''));
		if (!page) missing.push({ option, link });
		return page;
	};
	const configured = (entries: SidebarEntry[]): SidebarItem[] =>
		entries.flatMap((entry): SidebarItem[] => {
			if (typeof entry !== 'string' && 'dir' in entry) {
				const dir = entry.dir.replace(/^\.?\/+|\/+$/g, '');
				const inside = pages.filter((page) => !page.hidden && page.relative.startsWith(`${dir}/`));
				if (inside.length === 0) {
					missing.push({ option: 'sidebar', link: `${entry.dir}/` });
					return [];
				}
				// The pages sit under one chain of folders; walk down it to the folder's own group.
				let folder: SidebarItem = { type: 'group', title: '', items: buildSidebar(inside) };
				for (let depth = dir.split('/').length; depth > 0 && folder.type === 'group'; depth--) {
					folder = folder.items[0]!;
				}
				if (folder.type !== 'group') return [];
				// Nothing to open in a folder with only its own page.
				if (folder.items.length === 0 && folder.url)
					return [{ type: 'page', title: text(entry.text), url: folder.url }];
				return [{ ...folder, title: text(entry.text), collapsed: entry.collapsed }];
			}
			if (typeof entry !== 'string' && 'items' in entry) {
				return [
					{
						type: 'group',
						title: text(entry.text),
						items: configured(entry.items),
						collapsed: entry.collapsed
					}
				];
			}
			const target = resolve('sidebar', typeof entry === 'string' ? entry : entry.link);
			if (!target) return [];
			const title = typeof entry === 'string' ? undefined : text(entry.text);
			return typeof target === 'string'
				? [{ type: 'page', title: title ?? target, url: target }]
				: [{ type: 'page', title: title ?? target.label, url: target.url }];
		});
	// The config names the files of the working tree; an archived tag keeps the order of its own files.
	const sidebar =
		config.sidebar && !variant.version
			? configured(config.sidebar)
			: buildSidebar(pages.filter((page) => !page.hidden));
	const nav = config.nav.flatMap((entry): NavItem[] => {
		const target = resolve('nav', entry.link);
		if (!target) return [];
		return [{ title: text(entry.text), url: typeof target === 'string' ? target : target.url }];
	});
	const byUrl = new Map(pages.map((page) => [page.url, page]));
	const ordered: Page[] = [];
	const collect = (items: SidebarItem[]) => {
		for (const item of items) {
			const page = item.url ? byUrl.get(item.url) : undefined;
			if (page) ordered.push(page);
			if (item.type === 'group') collect(item.items);
		}
	};
	collect(sidebar);
	return {
		locale,
		root,
		prefix,
		pages,
		ordered,
		sidebar,
		nav,
		missing,
		byRelative
	};
}

/** Every page of a language: the sidebar's reading order, then the pages it leaves out. */
export function readingOrder(site: LocaleSite): Page[] {
	const listed = new Set(site.ordered);
	return [...site.ordered, ...site.pages.filter((page) => !listed.has(page))];
}

export async function scanSite(
	config: ResolvedConfig,
	variant = currentVariant(config)
): Promise<Site> {
	const localized = isLocalized(config, variant);
	if (config.locales.length > 0 && !localized && !variant.version) {
		const key = config.locales[0]!.key;
		throw new Error(
			`svelte-edda: \`locales\` is set, so pages belong in ${toPosix(relative(config.root, join(variant.docsDir, key)))}/ and the other language folders`
		);
	}

	let locales: LocaleSite[];
	if (!localized) {
		const pages = await readPages(config, variant.docsDir, variant.base, undefined);
		locales = [localeSite(config, variant, undefined, variant.docsDir, variant.base, pages)];
	} else {
		const [fallbackLocale, ...others] = config.locales as [ResolvedLocale, ...ResolvedLocale[]];
		const fallbackRoot = join(variant.docsDir, fallbackLocale.key);
		const fallbackPages = await readPages(config, fallbackRoot, variant.base, fallbackLocale);
		locales = [
			localeSite(config, variant, fallbackLocale, fallbackRoot, variant.base, fallbackPages)
		];

		for (const locale of others) {
			const root = join(variant.docsDir, locale.key);
			const prefix = `${variant.base}${locale.key}/`;
			const translated = await readPages(config, root, prefix, locale);
			const byRelative = new Map(translated.map((page) => [page.relative, page]));
			// Untranslated pages are shown in the default language, at this language's URLs.
			const missing = fallbackPages
				.filter((page) => !byRelative.has(page.relative))
				.map((page) => ({
					...page,
					url: page.slug ? `${prefix}${page.slug}/` : prefix,
					markdownUrl: `${prefix}${page.slug || 'index'}.md`,
					locale,
					fallback: true
				}));
			locales.push(localeSite(config, variant, locale, root, prefix, [...translated, ...missing]));
		}
	}

	const pages = locales.flatMap((site) => site.pages);
	const byUrl = new Map<string, Page>();
	for (const page of pages) {
		const other = byUrl.get(page.url);
		// A folder named like a language (`docs/en/ru/`) lands on that language's URLs.
		if (other) {
			throw new Error(
				`svelte-edda: ${toPosix(relative(config.root, other.file))} and ${toPosix(relative(config.root, page.file))} are both served at ${page.url}; rename one`
			);
		}
		byUrl.set(page.url, page);
	}
	if (!variant.version && !byUrl.has(variant.base)) {
		const home = toPosix(relative(config.root, join(locales[0]!.root, 'index.md')));
		throw new Error(`svelte-edda: ${home} is missing; it is the home page of the site`);
	}
	return { variant, localized, locales, pages, byUrl };
}

export function localeSiteOf(site: Site, page: Page): LocaleSite {
	return site.locales.find((entry) => entry.locale?.key === page.locale?.key) ?? site.locales[0]!;
}

/**
 * The page a relative link from `from` points to, within the reader's language: a link written in
 * a default-language page shown as a fallback still leads to the translated page when there is one.
 */
export function resolvePageLink(site: Site, from: Page, target: string): Page | undefined {
	const relativePath = toPosix(relative(from.sourceRoot, target));
	if (!relativePath.startsWith('..')) return localeSiteOf(site, from).byRelative.get(relativePath);
	for (const entry of site.locales) {
		const path = toPosix(relative(entry.root, target));
		if (!path.startsWith('..')) return entry.byRelative.get(path);
	}
	return undefined;
}

/**
 * URL of a file next to the pages, such as an image. A translation without its own copy of the
 * file uses the default language's one.
 */
export function resolveAssetUrl(site: Site, from: Page, target: string): string | undefined {
	const candidates = [target];
	const fallbackRoot = site.locales[0]?.root;
	if (fallbackRoot && from.sourceRoot !== fallbackRoot) {
		candidates.push(join(fallbackRoot, relative(from.sourceRoot, target)));
	}
	for (const candidate of candidates) {
		if (!existsSync(candidate)) continue;
		for (const entry of site.locales) {
			const path = toPosix(relative(entry.root, candidate));
			if (!path.startsWith('..')) return entry.prefix + assetPath(path);
		}
	}
	return undefined;
}

/** Every file next to the pages that the site serves, by URL. */
export async function siteAssets(site: Site): Promise<Map<string, string>> {
	const assets = new Map<string, string>();
	for (const entry of site.locales) {
		for (const path of await listFiles(entry.root)) {
			if (!path.endsWith('.md')) assets.set(entry.prefix + assetPath(path), join(entry.root, path));
		}
	}
	return assets;
}

type Folder = { name: string; index?: Page; pages: Page[]; folders: Map<string, Folder> };
type Sortable = { order: number; title: string; item: SidebarItem };

function buildSidebar(pages: Page[]): SidebarItem[] {
	const root: Folder = { name: '', pages: [], folders: new Map() };
	for (const page of pages) {
		let folder = root;
		for (const dir of page.relative.split('/').slice(0, -1)) {
			let next = folder.folders.get(dir);
			if (!next) {
				next = { name: dir, pages: [], folders: new Map() };
				folder.folders.set(dir, next);
			}
			folder = next;
		}
		if (page.isIndex) folder.index = page;
		else folder.pages.push(page);
	}

	const toItems = (folder: Folder): SidebarItem[] => {
		const items: Sortable[] = [
			...folder.pages.map((page) => ({
				order: page.order,
				title: page.label,
				item: { type: 'page', title: page.label, url: page.url } satisfies SidebarItem
			})),
			...[...folder.folders.values()].map((child) => {
				const title = child.index?.label ?? humanize(stripOrder(child.name));
				return {
					order: child.index?.order ?? orderOf(child.name),
					title,
					item: {
						type: 'group',
						title,
						url: child.index?.url,
						items: toItems(child)
					} satisfies SidebarItem
				};
			})
		];
		items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
		return items.map(({ item }) => item);
	};

	const items = toItems(root);
	if (root.index) items.unshift({ type: 'page', title: root.index.label, url: root.index.url });
	return items;
}
