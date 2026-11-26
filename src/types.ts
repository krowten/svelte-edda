import type { ElementContent } from 'hast';
import type { MessageKey } from './i18n/messages.ts';

/** A marker attribute: `key="value"` gives a string, a bare `key` gives `true`. */
export type AttributeValue = string | true;

export type AttributeDefinition = {
	type?: 'string' | 'boolean';
	/** Allowed values for a string attribute. */
	values?: readonly string[];
	required?: boolean;
	description?: string;
};

export type PrepareContext = {
	attributes: Record<string, AttributeValue>;
	/** Language of the page, e.g. `en` or `pt-BR`. The component also gets it as the `lang` prop. */
	lang: string;
	/** The content between the opening and closing markers, already rendered to HTML nodes. */
	children: ElementContent[];
	toHtml: (nodes: ElementContent[]) => string;
	/** Reports a problem at the component's position; `svelte-edda check` and `build` fail on it. */
	error: (message: string) => void;
};

export type ComponentDefinition = {
	/** Marker name: `<!-- name -->` … `<!-- /name -->`, or `<!-- name /-->` without content. */
	name: string;
	/** Path to the Svelte component, relative to the config file. */
	component: string;
	/** What the component is for. Shown by `svelte-edda guide` to whoever writes the docs. */
	description?: string;
	/** Markdown showing the component in use, for `svelte-edda guide`. Default: a bare marker pair. */
	example?: string;
	/** Declared attributes are validated; when omitted, any attribute is passed through. */
	attributes?: Record<string, AttributeDefinition>;
	/** Hydrate the component in the browser. Its props must be JSON-serializable. */
	interactive?: boolean;
	/**
	 * Turns the marker into component props. Without it the component receives the attributes as
	 * props and the inner content as the `children` snippet. A string `children` prop returned from
	 * here becomes the snippet too. Either way the component also gets `lang`, the page language.
	 */
	prepare?: (context: PrepareContext) => Record<string, unknown>;
};

export type DocsConfig = {
	title: string;
	description?: string;
	/** Directory with the Markdown sources. Default: `docs`. */
	docsDir?: string;
	/** Build output directory. Default: `dist`. */
	outDir?: string;
	/** Public base path, e.g. `/my-repo/` for a GitHub Pages project site. Default: `/`. */
	base?: string;
	/**
	 * Site origin, e.g. `https://user.github.io`: canonical URLs, structured data, `sitemap.xml`,
	 * `robots.txt` and absolute links in `llms.txt` need it.
	 */
	site?: string;
	/**
	 * Logo shown in the header instead of the title, which becomes its text alternative. Paths are
	 * relative to the config file; `dark` is used in dark mode.
	 */
	logo?: { src: string; dark?: string };
	/** CSS files imported after the default theme: Tailwind `@theme` overrides, fonts, extra styles. */
	css?: string | string[];
	/**
	 * Raw HTML added to every page's `<head>`, e.g. a font stylesheet link. A function receives the
	 * page and can return tags of its own, such as JSON-LD.
	 */
	head?: string[] | ((page: HeadContext) => string[]);
	/** Repository URL; enables the header link and "Edit this page". */
	repository?: string;
	/** Branch used for "Edit this page" links. Default: `main`. */
	branch?: string;
	components?: ComponentDefinition[];
	/** Language of monolingual documentation: `<html lang>` and the interface language. Default: `en`. */
	lang?: string;
	/**
	 * Translated documentation. Keys are folder names in the docs directory and URL prefixes:
	 * `{ en: { label: 'English' }, ru: { label: 'Русский' } }` reads `docs/en/` and `docs/ru/`.
	 */
	locales?: Record<string, LocaleConfig>;
	/** The language served without a URL prefix and used for untranslated pages. Default: the first locale. */
	defaultLocale?: string;
	/** Archived versions built from git tags, newest first. The working tree is always the latest version. */
	versions?: VersionConfig[];
	/** Interface strings in MessageFormat 2, by language: overrides and additional languages. */
	messages?: Record<string, Partial<Record<MessageKey, string>>>;
	/** Files copied to the site root as they are: favicon, robots.txt, images. Default: `public`. */
	publicDir?: string;
	/** Social preview image: a path inside `publicDir` or a URL. */
	ogImage?: string;
	/** Links in the header, beside the site title. */
	nav?: NavLink[];
	/**
	 * The sidebar, in order. Without it the sidebar follows the docs directory: folders become
	 * groups, and pages are ordered by `order` in frontmatter or a `10-` prefix in the file name.
	 */
	sidebar?: SidebarEntry[];
	/** Tools that write pages into the docs directory before every build, check and dev run. */
	generate?: Generator[];
};

/** The same text in every language, or text by locale key: `{ en: 'Guide', ru: 'Руководство' }`. */
export type LocalizedText = string | Record<string, string>;

/**
 * `link` is a page's file, relative to the docs directory (or to the language folder of translated
 * docs) as in `guide/install.md`, or an external URL.
 */
export type NavLink = { text: LocalizedText; link: string };

export type GenerateContext = {
	/** An empty directory to write the pages into; the engine moves them into `dir` afterwards. */
	outDir: string;
	/** The project root: the directory of the config file. */
	root: string;
};

/** Pages written by a tool, such as an API reference from TypeDoc. */
export type Generator = {
	/** Folder inside the docs directory that holds the generated pages and nothing else. */
	dir: string;
	/** Where the pages come from and what to edit instead of them. Shown to people and agents. */
	description: string;
	/** Files and folders, relative to the config file, whose changes make `dev` generate again. */
	watch?: string[];
	/**
	 * `true`: the pages are committed and `check` reports when they differ from what the generator
	 * writes now. `false` (default): they exist only in builds and belong in `.gitignore`.
	 */
	commit?: boolean;
	/** A function, or a shell command where `{outDir}` stands for the output directory. */
	run: string | ((context: GenerateContext) => void | Promise<void>);
};

/**
 * A group of the sidebar: the entries in `items`, or every page of the folder `dir`, ordered as in
 * a sidebar built from the docs directory. `collapsed` closes it until a reader opens it or reads
 * one of its pages.
 */
export type SidebarGroup = { text: LocalizedText; collapsed?: boolean } & (
	{ items: SidebarEntry[] } | { dir: string }
);

/** A page's file, named in the sidebar by its `sidebar` or `title`; a link with its own text; or a group. */
export type SidebarEntry = string | NavLink | SidebarGroup;

export type HeadContext = {
	/** Text of the page's `<title>`. */
	title: string;
	description?: string;
	/** Absolute when `site` is set. */
	url: string;
	lang: string;
	/** URL path without base and language prefix: `''` for the home page, `404` for the 404 page. */
	slug: string;
	/** Date of the last commit that touched the page, `YYYY-MM-DD`. */
	lastModified?: string;
	/** Label of the archived version the page belongs to. */
	version?: string;
};

export type LocaleConfig = {
	/** Name in the language menu, in its own language: `Deutsch`. */
	label: string;
	/** BCP 47 tag for `<html lang>`; defaults to the locale key. */
	lang?: string;
	dir?: 'ltr' | 'rtl';
};

export type VersionConfig = {
	/** Git tag the version is built from: `v1.4.2`. */
	tag: string;
	/** Name in the version menu. Default: the tag. */
	label?: string;
	/** URL segment under `/v/`. Default: derived from the label. */
	slug?: string;
};
