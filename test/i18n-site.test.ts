import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from '../src/build.ts';
import { check } from '../src/check.ts';
import { loadConfig } from '../src/config.ts';
import { scanSite } from '../src/pages.ts';

const root = join(import.meta.dir, 'fixtures', 'i18n');
const outDir = await mkdtemp(join(tmpdir(), 'svelte-edda-i18n-'));
const read = (path: string) => readFile(join(outDir, path), 'utf8');

beforeAll(async () => {
	await build({ ...(await loadConfig(root)), outDir });
}, 120_000);
afterAll(() => rm(outDir, { recursive: true, force: true }));

describe('scanSite with locales', () => {
	test('fills missing translations from the default language', async () => {
		const site = await scanSite(await loadConfig(root));
		const summary = site.locales.map((entry) => ({
			locale: entry.locale?.key,
			pages: entry.pages.map((page) => `${page.url}${page.fallback ? ' (fallback)' : ''}`).sort()
		}));
		expect(summary).toEqual([
			{ locale: 'en', pages: ['/poly/', '/poly/guide/'] },
			{ locale: 'ru', pages: ['/poly/ru/', '/poly/ru/guide/ (fallback)'] },
			{ locale: 'fr', pages: ['/poly/fr/ (fallback)', '/poly/fr/guide/'] }
		]);
	});

	test('check accepts the layout and points at untranslated menu texts', async () => {
		expect(await check(await loadConfig(root))).toEqual([
			{
				file: 'svelte-edda.config.ts',
				message: '`nav` text "Guide" has no "fr"; the "en" text is shown there',
				severity: 'warning'
			},
			{
				file: 'svelte-edda.config.ts',
				message: '`sidebar` text "Learn" has no "fr"; the "en" text is shown there',
				severity: 'warning'
			}
		]);
	});
});

describe('multilingual build', () => {
	test('sets the language and links translations', async () => {
		expect(await read('ru/index.html')).toContain('<html lang="ru" dir="ltr" ');
		const home = await read('index.html');
		expect(home).toContain(
			'<link rel="alternate" hreflang="en" href="https://example.dev/poly/" />'
		);
		expect(home).toContain(
			'<link rel="alternate" hreflang="ru" href="https://example.dev/poly/ru/" />'
		);
		// The French home page is a fallback, so it is not announced as a translation.
		expect(home).not.toContain('rel="alternate" hreflang="fr"');
		expect(home).toContain(
			'<link rel="alternate" hreflang="x-default" href="https://example.dev/poly/" />'
		);
	});

	test('gives components the language of the page', async () => {
		const greeting = (html: string) =>
			html.match(/<docs-island data-name="greeting"[\s\S]*?<\/docs-island>/)?.[0];
		expect(greeting(await read('index.html'))).toContain('Hello');
		expect(greeting(await read('ru/index.html'))).toContain('Привет');
		// The browser gets it too, to hydrate with the same text.
		expect(greeting(await read('ru/index.html'))).toContain(
			'data-props="{&quot;lang&quot;:&quot;ru&quot;}"'
		);
		// An untranslated page speaks the interface language of its section.
		expect(greeting(await read('fr/index.html'))).toContain(
			'data-props="{&quot;lang&quot;:&quot;fr&quot;}"'
		);
	});

	test('tells social networks which other languages exist', async () => {
		const home = await read('index.html');
		expect(home).toContain('<meta property="og:locale" content="en" />');
		expect(home).toContain('<meta property="og:locale:alternate" content="ru" />');
		expect(home).not.toContain('og:locale:alternate" content="fr"');
	});

	test('describes indexed pages with structured data', async () => {
		const jsonLd = (html: string) =>
			[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
				(match) => JSON.parse(match[1]!) as Record<string, unknown>
			);
		expect(jsonLd(await read('ru/index.html'))).toMatchObject([
			{ '@type': 'WebSite', url: 'https://example.dev/poly/ru/', inLanguage: 'ru' }
		]);
		expect(jsonLd(await read('guide/index.html'))).toMatchObject([
			{ '@type': 'TechArticle', headline: 'Guide', url: 'https://example.dev/poly/guide/' },
			{ '@type': 'BreadcrumbList' }
		]);
		// A fallback repeats the original, which already carries the description.
		expect(jsonLd(await read('ru/guide/index.html'))).toEqual([]);
	});

	test('describes a page by its first paragraph when frontmatter does not', async () => {
		expect(await read('guide/index.html')).toContain(
			'<meta name="description" content="Back home." />'
		);
		// The home page keeps the site description.
		expect(await read('index.html')).toContain(
			'<meta name="description" content="Fixture site in three languages." />'
		);
	});

	test('takes the header links and sidebar groups from the config, in the page language', async () => {
		const ru = await read('ru/index.html');
		expect(ru).toMatch(
			/data-testid="header-nav"[^>]*>(?:<!--[^>]*-->)?<a href="\/poly\/ru\/guide\/"[^>]*>\s*Руководство/
		);
		expect(ru).toContain('href="https://github.com/example/polyglot"');
		expect(ru).toContain('Изучение');
		// French has no text of its own and falls back to the default language.
		expect(await read('fr/index.html')).toMatch(/>\s*Learn\s*</);
		// The guide's header link is current on the guide.
		expect(await read('guide/index.html')).toMatch(
			/data-testid="header-nav"[^>]*>(?:<!--[^>]*-->)?<a href="\/poly\/guide\/" aria-current="page"/
		);
	});

	test('renders a collapsed group closed, except on its own pages', async () => {
		const group = (html: string) =>
			/aria-expanded="(\w+)" aria-controls="([^"]+)"[^>]*>\s*Learn/.exec(html)!;
		const home = await read('index.html');
		const [, expanded, list] = group(home);
		expect(expanded).toBe('false');
		expect(home).toContain(`<ul id="${list}" hidden`);
		expect(group(await read('guide/index.html'))[1]).toBe('true');
	});

	test('translates the interface, with English for languages it does not know', async () => {
		expect(await read('ru/index.html')).toMatch(
			/data-alert="note" role="note">\s*<p[^>]*>Примечание/
		);
		expect(await read('ru/index.html')).toContain('Поиск по документации');
		const french = await read('fr/guide/index.html');
		expect(french).toContain('Sur cette page');
		expect(french).toContain('Search the documentation');
	});

	test('marks untranslated pages and keeps readers in their language', async () => {
		const page = await read('ru/guide/index.html');
		expect(page).toContain('Эта страница ещё не переведена и показана на языке: English.');
		expect(page).toContain('href="/poly/ru/">home</a>');
		// Search engines are sent to the original, screen readers told the text is English.
		expect(page).toContain('<link rel="canonical" href="https://example.dev/poly/guide/" />');
		expect(page).toContain('<meta property="og:url" content="https://example.dev/poly/guide/" />');
		// Only the canonical copy announces translations.
		expect(page).not.toContain('rel="alternate" hreflang');
		expect(page).toMatch(/<article[^>]* lang="en"/);
		expect(await read('ru/index.html')).toContain('href="/poly/ru/guide/">руководства</a>');
	});

	test('offers every language in the menu', async () => {
		const page = await read('ru/guide/index.html');
		expect(page).toContain('data-testid="language-menu"');
		for (const [href, label] of [
			['/poly/guide/', 'English'],
			['/poly/ru/guide/', 'Русский'],
			['/poly/fr/guide/', 'Français']
		]) {
			expect(page).toMatch(new RegExp(`href="${href}"[^>]*>\\s*${label}`));
		}
	});

	test('shares images with translations that have no copy', async () => {
		expect(await read('fr/guide/index.html')).toContain('src="/poly/guide/logo.svg"');
		expect(existsSync(join(outDir, 'guide/logo.svg'))).toBe(true);
	});

	test('copies the public directory and links its icons and social image', async () => {
		expect(await read('robots.txt')).toContain('User-agent');
		const home = await read('index.html');
		expect(home).toContain('<link rel="icon" type="image/svg+xml" href="/poly/favicon.svg" />');
		expect(home).toContain(
			'<meta property="og:image" content="https://example.dev/poly/og.png" />'
		);
		expect(home).toContain('<link rel="canonical" href="https://example.dev/poly/" />');
	});

	test('lists every language in the sitemap and only the default one in llms.txt', async () => {
		const sitemap = await read('sitemap.xml');
		for (const url of ['/poly/', '/poly/guide/', '/poly/ru/', '/poly/fr/guide/']) {
			expect(sitemap).toContain(`<loc>https://example.dev${url}</loc>`);
		}
		expect(sitemap).not.toContain('/poly/ru/guide/');
		const llms = await read('llms.txt');
		expect(llms).toContain('- [Guide](https://example.dev/poly/guide.md)');
		expect(llms).not.toContain('/ru/');
		expect(await read('ru/index.md')).toContain('[руководства](/poly/ru/guide.md)');
	});

	test('adds the tags a `head` function returns for the page', async () => {
		expect(await read('ru/index.html')).toContain(
			'<meta name="fixture" content="ru||https://example.dev/poly/ru/" />'
		);
		expect(await read('guide/index.html')).toContain(
			'<meta name="fixture" content="en|guide|https://example.dev/poly/guide/" />'
		);
		expect(await read('404.html')).toContain('<meta name="robots" content="noindex" />');
	});

	test('builds a search index per language', async () => {
		const entry = JSON.parse(await read('pagefind/pagefind-entry.json')) as {
			languages: Record<string, unknown>;
		};
		expect(Object.keys(entry.languages).sort()).toEqual(['en', 'fr', 'ru']);
	});
});
