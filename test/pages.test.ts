import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { BuildError, build } from '../src/build.ts';
import { check, checkNavigation } from '../src/check.ts';
import { resolveConfig } from '../src/config.ts';
import { scanSite } from '../src/pages.ts';

const roots: string[] = [];
afterAll(() => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

/** A throwaway project with the given files under `docs/`. */
async function project(files: Record<string, string>) {
	const root = await mkdtemp(join(tmpdir(), 'svelte-edda-pages-'));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, 'docs', path)), { recursive: true });
		await writeFile(join(root, 'docs', path), content);
	}
	return root;
}

describe('scanSite', () => {
	test('names a page for the document, the sidebar and the layout separately', async () => {
		const root = await project({
			'index.md': '# Welcome\n',
			'start.md': '---\ntitle: How to start\nsidebar: Start\nlayout: landing\n---\n\n# Begin\n',
			'plain.md': '# Plain\n',
			'named.md': '---\ntitle: Lib for streams\n---\n\n# Named\n'
		});
		const site = await scanSite(resolveConfig(root, { title: 'Lib' }));
		const pages = Object.fromEntries(
			site.pages.map((page) => [
				page.slug,
				[page.title, page.label, page.documentTitle, page.layout]
			])
		);
		expect(pages).toEqual({
			'': ['Welcome', 'Welcome', 'Lib', 'docs'],
			start: ['How to start', 'Start', 'How to start | Lib', 'landing'],
			plain: ['Plain', 'Plain', 'Plain | Lib', 'docs'],
			named: ['Lib for streams', 'Lib for streams', 'Lib for streams', 'docs']
		});
		expect(site.locales[0]!.sidebar.map((item) => item.title)).toEqual([
			'Welcome',
			'Lib for streams',
			'Plain',
			'Start'
		]);
	});

	test('takes the URL from `slug`, whatever folder the file is in', async () => {
		const root = await project({
			'index.md': '# Home\n',
			'10-guide/20-streams.md': '---\nslug: streams\n---\n\n# Streams\n'
		});
		const site = await scanSite(resolveConfig(root, { title: 'Lib', base: '/lib/' }));
		const page = site.byUrl.get('/lib/streams/')!;
		expect([page.markdownUrl, page.relative]).toEqual([
			'/lib/streams.md',
			'10-guide/20-streams.md'
		]);
		// Still listed under its folder.
		expect(site.locales[0]!.sidebar[1]).toEqual({
			type: 'group',
			title: 'Guide',
			url: undefined,
			items: [{ type: 'page', title: 'Streams', url: '/lib/streams/' }]
		});
	});

	test('refuses a site without a home page', async () => {
		const root = await project({ 'guide.md': '# Guide\n' });
		expect(scanSite(resolveConfig(root, { title: 'Lib' }))).rejects.toThrow(
			'svelte-edda: docs/index.md is missing; it is the home page of the site'
		);
	});

	test('refuses two files for one URL', async () => {
		const root = await project({
			'index.md': '# Home\n',
			'guide.md': '# Guide\n',
			'guide/index.md': '# Guide folder\n'
		});
		expect(scanSite(resolveConfig(root, { title: 'Lib' }))).rejects.toThrow(
			'svelte-edda: guide.md and guide/index.md in docs/ are the same page, /guide/; remove one'
		);
	});

	test('refuses a folder that lands on the URLs of a language', async () => {
		const root = await project({
			'en/index.md': '# Home\n',
			'en/ru/index.md': '# Not Russian\n',
			'ru/index.md': '# Главная\n'
		});
		const config = resolveConfig(root, {
			title: 'Lib',
			locales: { en: { label: 'English' }, ru: { label: 'Русский' } }
		});
		expect(scanSite(config)).rejects.toThrow(
			'svelte-edda: docs/en/ru/index.md and docs/ru/index.md are both served at /ru/; rename one'
		);
	});

	test('keeps index.md when a folder also has README.md', async () => {
		const root = await project({ 'index.md': '# Index\n', 'README.md': '# Readme\n' });
		const site = await scanSite(resolveConfig(root, { title: 'Lib' }));
		expect(site.pages.map((page) => page.title)).toEqual(['Index']);
	});
});

test('config refuses a language that is not a language tag', () => {
	expect(() => resolveConfig('/tmp', { title: 'Lib', lang: 'not a tag' })).toThrow(
		'svelte-edda: "not a tag" is not a language tag such as "en" or "pt-BR"'
	);
});

test('config refuses a component attribute named lang', () => {
	expect(() =>
		resolveConfig(join(import.meta.dir, 'fixtures', 'basic'), {
			title: 'Lib',
			components: [{ name: 'hint', component: 'components/Badge.svelte', attributes: { lang: {} } }]
		})
	).toThrow('svelte-edda: "hint" cannot declare a "lang" attribute');
});

describe('configured navigation', () => {
	test('builds the sidebar from the config and reports what it misses', async () => {
		const root = await project({
			'index.md': '# Home\n',
			'intro.md': '# Introduction\n',
			'guide/install.md': '# Install\n',
			'forgotten.md': '# Forgotten\n',
			'hidden.md': '---\nsidebar: false\n---\n\n# Hidden\n'
		});
		const config = resolveConfig(root, {
			title: 'Lib',
			nav: [{ text: 'Guide', link: 'guide/install.md' }],
			sidebar: [
				'intro.md',
				{ text: 'Guide', items: [{ text: 'Setup', link: './guide/install.md' }, 'gone.md'] },
				{ text: 'GitHub', link: 'https://github.com/me/lib' }
			]
		});
		const site = await scanSite(config);
		const locale = site.locales[0]!;
		expect(locale.sidebar).toEqual([
			{ type: 'page', title: 'Introduction', url: '/intro/' },
			{
				type: 'group',
				title: 'Guide',
				items: [{ type: 'page', title: 'Setup', url: '/guide/install/' }]
			},
			{ type: 'page', title: 'GitHub', url: 'https://github.com/me/lib' }
		]);
		expect(locale.nav).toEqual([{ title: 'Guide', url: '/guide/install/' }]);
		expect(locale.ordered.map((page) => page.slug)).toEqual(['intro', 'guide/install']);
		expect(
			checkNavigation(config, site).map((d) => [d.severity, d.file, d.message.split(';')[0]])
		).toEqual([
			['error', 'config', '`sidebar` names gone.md, which is not a page in docs/'],
			['warning', 'docs/forgotten.md', 'the page is not in `sidebar` of config']
		]);
	});

	test('leaves `sidebar: false` pages out of the sidebar built from folders', async () => {
		const root = await project({
			'index.md': '# Home\n',
			'shown.md': '# Shown\n',
			'hidden.md': '---\nsidebar: false\n---\n\n# Hidden\n'
		});
		const site = await scanSite(resolveConfig(root, { title: 'Lib' }));
		expect(site.locales[0]!.sidebar.map((item) => item.title)).toEqual(['Home', 'Shown']);
		expect(site.byUrl.has('/hidden/')).toBe(true);
	});

	test('fills a group with every page of a folder', async () => {
		const root = await project({
			'index.md': '# Home\n',
			'reference/api/index.md': '# API\n',
			'reference/api/zeta.md': '# Zeta\n',
			'reference/api/alpha.md': '# Alpha\n',
			'reference/api/hidden.md': '---\nsidebar: false\n---\n\n# Hidden\n'
		});
		const config = resolveConfig(root, {
			title: 'Lib',
			sidebar: [
				{ text: 'API', dir: 'reference/api', collapsed: true },
				{ text: 'Gone', dir: 'nowhere' }
			]
		});
		const site = await scanSite(config);
		expect(site.locales[0]!.sidebar).toEqual([
			{
				type: 'group',
				title: 'API',
				url: '/reference/api/',
				collapsed: true,
				items: [
					{ type: 'page', title: 'Alpha', url: '/reference/api/alpha/' },
					{ type: 'page', title: 'Zeta', url: '/reference/api/zeta/' }
				]
			}
		]);
		// The folder's pages count as listed; only the missing folder is reported.
		expect(checkNavigation(config, site).map((d) => d.message)).toEqual([
			'`sidebar` names nowhere/, which is not a page in docs/'
		]);
	});
});

test('a folder group with only its own page is a plain link', async () => {
	const root = await project({ 'index.md': '# Home\n', 'changelog/index.md': '# Changes\n' });
	const site = await scanSite(
		resolveConfig(root, { title: 'Lib', sidebar: [{ text: 'Changelog', dir: 'changelog' }] })
	);
	expect(site.locales[0]!.sidebar).toEqual([
		{ type: 'page', title: 'Changelog', url: '/changelog/' }
	]);
});

describe('mistakes that check and build report alike', () => {
	const failure = async (config: ReturnType<typeof resolveConfig>) => {
		const error = await build(config).catch((thrown: unknown) => thrown);
		expect(error).toBeInstanceOf(BuildError);
		return (error as BuildError).diagnostics.filter((d) => d.severity === 'error');
	};

	test('invalid frontmatter, with file and line', async () => {
		const root = await project({
			'index.md': '# Home\n',
			'part.md': '---\norder: 1\ntitle: Guide: Part 1\n---\n\n# Part\n'
		});
		const config = resolveConfig(root, { title: 'Lib' });
		const [diagnostic] = await check(config);
		expect(diagnostic).toMatchObject({ file: 'docs/part.md', line: 3, severity: 'error' });
		expect(diagnostic!.message).toStartWith('Invalid frontmatter: ');
		expect(await failure(config)).toEqual([diagnostic!]);
	});

	test('a file outside the language folders', async () => {
		const root = await project({ 'en/index.md': '# Home\n', 'stray.md': '# Stray\n' });
		const config = resolveConfig(root, { title: 'Lib', locales: { en: { label: 'English' } } });
		expect((await failure(config)).map((d) => d.file)).toEqual(['docs/stray.md']);
	}, 60_000);
});

test('diagnostics of docs outside the project root stay relative to it', async () => {
	const root = await project({ 'index.md': '[Gone](./gone.md)\n' });
	const diagnostics = await check(
		resolveConfig(join(root, 'site'), { title: 'Lib', docsDir: '../docs' })
	);
	expect(diagnostics.filter((d) => d.severity === 'error').map((d) => d.file)).toEqual([
		'../docs/index.md'
	]);
});

test('check warns about a path in `site`', async () => {
	const root = await project({ 'index.md': '# Home\n' });
	const site = 'https://me.github.io/repo';
	const diagnostics = await check(resolveConfig(root, { title: 'Lib', site, base: '/repo/' }));
	expect(diagnostics.map((d) => [d.severity, d.message.slice(-29)])).toEqual([
		['warning', 'Set `site` to https://me.github.io'.slice(-29)]
	]);
});

test('one header link at most is current', async () => {
	const root = await project({
		'index.md': '# Home\n',
		'start.md': '# Start\n',
		'end.md': '# End\n'
	});
	const outDir = join(root, 'dist');
	await build(
		resolveConfig(root, {
			title: 'Lib',
			outDir,
			nav: [
				{ text: 'Overview', link: 'index.md' },
				{ text: 'Start', link: 'start.md' }
			],
			sidebar: [{ text: 'Intro', items: ['index.md', 'start.md', 'end.md'] }]
		})
	);
	const current = async (path: string) => {
		const html = await readFile(join(outDir, path, 'index.html'), 'utf8');
		const nav = /data-testid="header-nav"[\s\S]*?<\/nav>/.exec(html)![0];
		return [...nav.matchAll(/href="([^"]*)" aria-current="(\w+)"/g)].map((match) => match.slice(1));
	};
	expect(await current('start')).toEqual([['/start/', 'page']]);
	expect(await current('end')).toEqual([['/', 'true']]);
}, 60_000);
