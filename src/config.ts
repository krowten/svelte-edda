import type { MessageOverrides } from './i18n/translator.ts';
import type {
	AttributeDefinition,
	ComponentDefinition,
	DocsConfig,
	Generator,
	HeadContext,
	NavLink,
	SidebarEntry
} from './types.ts';

import { existsSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { loadConfigFromFile } from 'vite';

import { cards, hero, steps } from './components/blocks.ts';
import { tabs } from './components/tabs.ts';
import { validateMessages } from './i18n/translator.ts';
import { isInside, toPosix } from './paths.ts';

export const CONFIG_FILES = [
	'svelte-edda.config.ts',
	'svelte-edda.config.js',
	'svelte-edda.config.mjs'
];

export type ResolvedComponent = Omit<ComponentDefinition, 'component'> & {
	/** Absolute path to the `.svelte` file. */
	component: string;
};

export type ResolvedConfig = {
	root: string;
	configFile?: string;
	title: string;
	description?: string;
	/** Language of monolingual documentation. */
	lang: string;
	docsDir: string;
	outDir: string;
	/** Always starts and ends with `/`. */
	base: string;
	site?: string;
	logo?: { src: string; dark?: string };
	css: string[];
	head: (page: HeadContext) => string[];
	repository?: string;
	branch: string;
	components: Map<string, ResolvedComponent>;
	/** Empty when the documentation is in one language. The default locale comes first. */
	locales: ResolvedLocale[];
	/** Archived versions, newest first. */
	versions: ResolvedVersion[];
	messages: MessageOverrides;
	publicDir?: string;
	ogImage?: string;
	nav: NavLink[];
	/** Undefined when the sidebar follows the docs directory. */
	sidebar?: SidebarEntry[];
	generate: ResolvedGenerator[];
	/** Generated files: CSS entry, client entry, live demos, extracted versions. */
	cacheDir: string;
};

export type ResolvedGenerator = {
	/** Absolute path of the generated folder. */
	dir: string;
	description: string;
	/** Absolute paths. */
	watch: string[];
	commit: boolean;
	run: Generator['run'];
};

export type ResolvedLocale = {
	key: string;
	label: string;
	lang: string;
	dir: 'ltr' | 'rtl';
	isDefault: boolean;
};

export type ResolvedVersion = { tag: string; label: string; slug: string };

const NAME = /^[a-z][a-z0-9-]*$/;

export async function loadConfig(root: string): Promise<ResolvedConfig> {
	const configFile = CONFIG_FILES.map((name) => join(root, name)).find((file) => existsSync(file));
	if (!configFile) return resolveConfig(root, { title: basename(root) });

	// Vite bundles the config to a fresh file on every load: TypeScript works on any supported
	// Node, and a reload in the dev server never sees a cached module.
	const loaded = await loadConfigFromFile(
		{ command: 'serve', mode: 'development' },
		configFile,
		root,
		'silent',
		undefined,
		'bundle'
	);
	if (!loaded?.config) throw new Error(`${configFile} must have a default export`);
	return resolveConfig(root, loaded.config as unknown as DocsConfig, configFile);
}

export function resolveConfig(root: string, user: DocsConfig, configFile?: string): ResolvedConfig {
	if (typeof user.title !== 'string' || !user.title)
		throw new Error('svelte-edda: `title` is required');

	const fromRoot = (path: string) => resolve(root, path);
	const isUrl = (path: string) => /^(https?:)?\/\//.test(path) || path.startsWith('data:');
	const asset = (path: string) => {
		if (isUrl(path)) return path;
		const file = fromRoot(path);
		if (!existsSync(file)) throw new Error(`svelte-edda: file not found: ${path}`);
		return file;
	};

	const language = (tag: string) => {
		try {
			Intl.getCanonicalLocales(tag);
		} catch (error) {
			throw new Error(`svelte-edda: "${tag}" is not a language tag such as "en" or "pt-BR"`, {
				cause: error
			});
		}
		return tag;
	};

	const components = new Map<string, ResolvedComponent>(
		[tabs, cards, steps, hero].map((component) => [component.name, component])
	);
	for (const definition of user.components ?? []) {
		if (!NAME.test(definition.name)) {
			throw new Error(
				`svelte-edda: component name "${definition.name}" must be lowercase kebab-case`
			);
		}
		// A user component may replace a built-in one with the same name.
		components.set(definition.name, { ...definition, component: asset(definition.component) });
	}
	for (const definition of components.values()) validateAttributeDefinitions(definition);

	const localeEntries = Object.entries(user.locales ?? {});
	const defaultLocale = user.defaultLocale ?? localeEntries[0]?.[0];
	if (defaultLocale !== undefined && !user.locales?.[defaultLocale]) {
		throw new Error(`svelte-edda: defaultLocale "${defaultLocale}" is not one of the locales`);
	}
	const locales: ResolvedLocale[] = localeEntries
		.map(([key, locale]) => {
			if (key === 'v' || (!NAME.test(key) && !/^[a-z]{2,3}(-[a-z0-9]+)*$/i.test(key))) {
				throw new Error(
					`svelte-edda: locale key "${key}" must be a language code such as "en" or "pt-br"`
				);
			}
			return {
				key,
				label: locale.label,
				lang: language(locale.lang ?? key),
				dir: locale.dir ?? 'ltr',
				isDefault: key === defaultLocale
			};
		})
		.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

	const versions = (user.versions ?? []).map((version) => {
		const label = version.label ?? version.tag;
		const slug = version.slug ?? label.replace(/^v(?=\d)/, '').replace(/[^\w.-]+/g, '-');
		if (!slug || slug.startsWith('.'))
			throw new Error(`svelte-edda: version "${version.tag}" needs a slug`);
		return { tag: version.tag, label, slug };
	});
	const slugs = versions.map((version) => version.slug);
	if (new Set(slugs).size !== slugs.length)
		throw new Error('svelte-edda: version slugs must be unique');

	const docsDir = fromRoot(user.docsDir ?? 'docs');
	const generate = (user.generate ?? []).map((generator) => resolveGenerator(generator, docsDir));
	for (const [index, one] of generate.entries()) {
		for (const other of generate.slice(index + 1)) {
			if (isInside(one.dir, other.dir) || isInside(other.dir, one.dir)) {
				throw new Error(
					`svelte-edda: generators for "${toPosix(relative(docsDir, one.dir))}" and "${toPosix(relative(docsDir, other.dir))}" share a folder; give each its own`
				);
			}
		}
	}
	for (const { dir } of generate) {
		if (locales.length > 0 && !locales.some(({ key }) => isInside(join(docsDir, key), dir))) {
			throw new Error(
				`svelte-edda: with \`locales\` set, a generator's \`dir\` starts with a language folder: "${locales[0]!.key}/${toPosix(relative(docsDir, dir))}"`
			);
		}
	}
	const resolveWatch = (generator: ResolvedGenerator) => ({
		...generator,
		watch: generator.watch.map(fromRoot)
	});

	const messages = user.messages ?? {};
	validateMessages(messages);

	const publicDir = fromRoot(user.publicDir ?? 'public');
	const hasPublicDir = existsSync(publicDir);
	if (user.publicDir && !hasPublicDir)
		throw new Error(`svelte-edda: publicDir not found: ${user.publicDir}`);
	if (
		user.ogImage &&
		!isUrl(user.ogImage) &&
		!(hasPublicDir && existsSync(join(publicDir, user.ogImage)))
	) {
		throw new Error(
			`svelte-edda: ogImage "${user.ogImage}" is neither a URL nor a file in publicDir`
		);
	}

	return {
		root,
		configFile,
		title: user.title,
		description: user.description,
		lang: language(user.lang ?? 'en'),
		docsDir,
		outDir: fromRoot(user.outDir ?? 'dist'),
		base: normalizeBase(user.base ?? '/'),
		site: user.site?.replace(/\/+$/, ''),
		logo: user.logo && {
			src: asset(user.logo.src),
			dark: user.logo.dark && asset(user.logo.dark)
		},
		css: [user.css ?? []].flat().map(asset),
		head: typeof user.head === 'function' ? user.head : () => (user.head as string[]) ?? [],
		repository: user.repository?.replace(/\/+$/, ''),
		branch: user.branch ?? 'main',
		components,
		locales,
		versions,
		messages,
		publicDir: hasPublicDir ? publicDir : undefined,
		ogImage:
			user.ogImage && (isUrl(user.ogImage) ? user.ogImage : user.ogImage.replace(/^\/+/, '')),
		nav: user.nav ?? [],
		sidebar: user.sidebar,
		generate: generate.map(resolveWatch),
		cacheDir: join(root, 'node_modules', '.svelte-edda')
	};
}

function resolveGenerator(generator: Generator, docsDir: string): ResolvedGenerator {
	const dir = resolve(docsDir, generator.dir ?? '');
	if (!generator.dir || dir === docsDir || !isInside(docsDir, dir)) {
		throw new Error(
			`svelte-edda: a generator's \`dir\` must be a folder inside the docs directory, got "${generator.dir ?? ''}"`
		);
	}
	const name = toPosix(relative(docsDir, dir));
	if (!generator.description?.trim()) {
		throw new Error(
			`svelte-edda: the generator for "${name}" needs a \`description\`: where its pages come from and what to edit instead`
		);
	}
	if (generator.description.includes('-->')) {
		throw new Error(
			`svelte-edda: the description of the generator for "${name}" cannot contain "-->"`
		);
	}
	return {
		dir,
		description: generator.description.trim(),
		watch: generator.watch ?? [],
		commit: generator.commit ?? false,
		run: generator.run
	};
}

function normalizeBase(base: string): string {
	const trimmed = base.replace(/^\/+|\/+$/g, '');
	return trimmed ? `/${trimmed}/` : '/';
}

function validateAttributeDefinitions(definition: ResolvedComponent): void {
	for (const [name, attribute] of Object.entries(definition.attributes ?? {}) as [
		string,
		AttributeDefinition
	][]) {
		if (name === 'lang') {
			throw new Error(
				`svelte-edda: "${definition.name}" cannot declare a "lang" attribute: every component gets the page language as the \`lang\` prop`
			);
		}
		if (attribute.values && attribute.type === 'boolean') {
			throw new Error(
				`svelte-edda: attribute "${name}" of "${definition.name}" cannot be boolean and have values`
			);
		}
	}
}
