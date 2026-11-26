import type { ResolvedConfig } from '../src/config.ts';

import { describe, expect, test } from 'bun:test';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { robotsTxt } from '../src/llms.ts';
import { summarize } from '../src/markdown/index.ts';
import { structuredData } from '../src/structured-data.ts';

const hast = (markdown: string) => {
	const processor = unified().use(remarkParse).use(remarkRehype);
	return processor.runSync(processor.parse(markdown));
};

describe('summary', () => {
	test('takes the first paragraph with text, skipping badges and alerts', () => {
		const tree = hast(
			'# Title\n\n[![npm](x.svg)](y)\n\n> Quoted.\n\nThe   **real**\nopening.\n\nMore.'
		);
		expect(summarize(tree)).toBe('The real opening.');
	});

	test('cuts a long paragraph at a word', () => {
		const summary = summarize(hast(`${'word '.repeat(60)}end.`))!;
		expect(summary.length).toBeLessThanOrEqual(160);
		expect(summary).toEndWith('word…');
	});

	test('is undefined for a page without paragraphs', () => {
		expect(summarize(hast('# Title\n\n- item'))).toBeUndefined();
	});
});

describe('structured data', () => {
	const sidebar = [
		{ type: 'page' as const, title: 'Intro', url: '/lib/' },
		{
			type: 'group' as const,
			title: 'Guide',
			url: '/lib/guide/',
			items: [
				{
					type: 'group' as const,
					title: 'No page',
					items: [{ type: 'page' as const, title: 'Install', url: '/lib/guide/install/' }]
				}
			]
		}
	];
	const input = (url: string, isHome = false) => ({
		origin: 'https://me.dev',
		siteTitle: 'Lib',
		home: '/lib/',
		sidebar,
		page: { url, title: 'Install', description: 'How.', lang: 'en', modified: '2026-11-17', isHome }
	});

	test('describes a home page as the website', () => {
		expect(structuredData(input('/lib/', true))).toEqual([
			{
				'@context': 'https://schema.org',
				'@type': 'WebSite',
				name: 'Lib',
				url: 'https://me.dev/lib/',
				description: 'How.',
				inLanguage: 'en'
			}
		]);
	});

	test('gives other pages an article and the sidebar path as breadcrumbs', () => {
		const [article, breadcrumbs] = structuredData(input('/lib/guide/install/'));
		expect(article).toMatchObject({
			'@type': 'TechArticle',
			headline: 'Install',
			url: 'https://me.dev/lib/guide/install/',
			dateModified: '2026-11-17',
			isPartOf: { '@type': 'WebSite', url: 'https://me.dev/lib/' }
		});
		expect(breadcrumbs).toMatchObject({
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ position: 1, name: 'Lib', item: 'https://me.dev/lib/' },
				{ position: 2, name: 'Guide', item: 'https://me.dev/lib/guide/' },
				{ position: 3, name: 'Install', item: 'https://me.dev/lib/guide/install/' }
			]
		});
	});

	test('ends the breadcrumbs at a page missing from the sidebar', () => {
		const [, breadcrumbs] = structuredData(input('/lib/hidden/'));
		expect(breadcrumbs).toMatchObject({
			itemListElement: [{ name: 'Lib' }, { name: 'Install', item: 'https://me.dev/lib/hidden/' }]
		});
	});
});

describe('robots.txt', () => {
	const config = (site: string | undefined, base: string) => ({ site, base }) as ResolvedConfig;

	test('points at the sitemap of a site at the root of its host', () => {
		expect(robotsTxt(config('https://me.dev', '/'))).toBe(
			'User-agent: *\nAllow: /\n\nSitemap: https://me.dev/sitemap.xml\n'
		);
	});

	test('is left out where crawlers would not read it or the sitemap has no URL', () => {
		expect(robotsTxt(config('https://me.github.io', '/lib/'))).toBeUndefined();
		expect(robotsTxt(config(undefined, '/'))).toBeUndefined();
	});
});
