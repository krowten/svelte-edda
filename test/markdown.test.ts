import type { ResolvedConfig } from '../src/config.ts';
import type { Site } from '../src/pages.ts';

import { beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { loadConfig } from '../src/config.ts';
import { createTranslator } from '../src/i18n/translator.ts';
import { renderMarkdown } from '../src/markdown/index.ts';
import { parseMarker } from '../src/markdown/markers.ts';
import { rewriteSourceLinks } from '../src/markdown/source.ts';
import { scanSite } from '../src/pages.ts';

const root = join(import.meta.dir, 'fixtures', 'basic');
let config: ResolvedConfig;
let site: Site;

beforeAll(async () => {
	config = await loadConfig(root);
	site = await scanSite(config);
});

const home = () => site.byUrl.get('/fixture/')!;
const t = createTranslator('en');
const render = (source: string) => renderMarkdown({ config, site, page: home(), source, t });
const errors = async (source: string) =>
	(await render(source)).diagnostics
		.filter((diagnostic) => diagnostic.severity === 'error')
		.map((d) => d.message);

describe('parseMarker', () => {
	test('reads names, attributes and closing forms', () => {
		expect(parseMarker('<!-- tabs sync="pm" wide -->')).toEqual({
			name: 'tabs',
			closing: false,
			selfClosing: false,
			attributes: { sync: 'pm', wide: true }
		});
		expect(parseMarker('<!-- /tabs -->')?.closing).toBe(true);
		expect(parseMarker('<!-- counter /-->')?.selfClosing).toBe(true);
		expect(parseMarker('<!-- just a comment, really -->')).toBeUndefined();
	});
});

describe('scanSite', () => {
	test('strips order prefixes from URLs and orders the sidebar by them', () => {
		expect(site.locales[0]!.ordered.map((page) => page.url)).toEqual([
			'/fixture/',
			'/fixture/guide/',
			'/fixture/guide/concepts/',
			'/fixture/guide/install/',
			'/fixture/landing/',
			'/fixture/blocks/'
		]);
		expect(site.byUrl.get('/fixture/guide/concepts/')?.title).toBe('Core concepts');
		expect(site.byUrl.get('/fixture/guide/install/')?.markdownUrl).toBe(
			'/fixture/guide/install.md'
		);
	});
});

describe('renderMarkdown', () => {
	test('highlights a code block without a language like any other', async () => {
		const { html } = await render('```\nplain\n```\n\n    indented\n');
		expect(html.match(/<pre class="shiki /g)).toHaveLength(2);
		expect(html.match(/--shiki-dark:/g)?.length).toBeGreaterThanOrEqual(2);
	});

	test('turns GitHub alerts into asides', async () => {
		const { html } = await render('> [!WARNING]\n> Careful.');
		expect(html).toMatch(/<aside [^>]*data-alert="warning" role="note">\s*<p [^>]*>Warning<\/p>/);
		expect(html).not.toContain('[!WARNING]');
	});

	test('keeps the leading title and collects headings with GitHub-style ids', async () => {
		const { html, headings, titled } = await render(
			'# Title\n\n## Getting started\n\n### API & usage'
		);
		expect(html).toContain('<h1 id="title">Title</h1>');
		expect(titled).toBe(true);
		expect((await render('Text first.\n\n# Late title')).titled).toBe(false);
		// A plain comment is not content; a component marker is.
		expect((await render('<!-- prettier-ignore -->\n\n# Title')).titled).toBe(true);
		expect((await render('<!-- counter /-->\n\n# Title')).titled).toBe(false);
		expect(headings).toEqual([
			{ depth: 2, id: 'getting-started', text: 'Getting started' },
			{ depth: 3, id: 'api--usage', text: 'API & usage' }
		]);
	});

	test('warns about a link from the domain root, which skips the base path', async () => {
		const { diagnostics } = await render('[a](/guide/) [b](/fixture/guide/) [c](//cdn.example/x)');
		expect(diagnostics.map((diagnostic) => [diagnostic.severity, diagnostic.message])).toEqual([
			[
				'warning',
				'/guide/ points outside the site, which is served under /fixture/; link to the file instead, like ./page.md'
			]
		]);
	});

	test('wraps tables so that wide ones scroll', async () => {
		const { html } = await render('| a | b |\n| - | - |\n| 1 | 2 |');
		expect(html).toContain('<div class="overflow-x-auto" tabindex="0"><table>');
	});

	test('rewrites links to pages and assets', async () => {
		const { html } = await render(
			'[Install](./10-guide/20-install.md#usage) ![x](./10-guide/diagram.svg)'
		);
		expect(html).toContain('href="/fixture/guide/install/#usage"');
		expect(html).toContain('src="/fixture/guide/diagram.svg"');
	});

	test('reports broken links', async () => {
		expect(await errors('[Gone](./missing.md)')).toEqual([
			'Broken link: ./missing.md (no page at docs/missing.md)'
		]);
	});

	test('validates markers and attributes', async () => {
		expect(await errors('<!-- tabs -->\n\n**npm**\n\nx')).toEqual([
			'<!-- tabs --> is never closed with <!-- /tabs -->'
		]);
		expect(await errors('text\n\n<!-- /tabs -->')).toEqual([
			'Unexpected <!-- /tabs -->: no open <!-- tabs --> here'
		]);
		expect(await errors('<!-- badge tone="loud" -->\n\nx\n\n<!-- /badge -->')).toEqual([
			'Attribute "tone" on <!-- badge --> must be one of: info, new'
		]);
		expect(await errors('<!-- badge -->\n\nx\n\n<!-- /badge -->')).toEqual([
			'<!-- badge --> requires the "tone" attribute'
		]);
		expect(await errors('<!-- counter lang="ru" /-->')).toEqual([
			'<!-- counter --> gets the page language as `lang` by itself; remove the attribute'
		]);
		expect(await errors("<!-- counter start='1' /-->")).toEqual([
			'Malformed <!-- counter -->: write attributes as name="value", in double quotes'
		]);
		expect(await errors('<!-- counter: see the demo page -->\n\ntext')).toEqual([]);
		expect(await errors('<!-- prettier-ignore -->\n\ntext')).toEqual([]);
	});

	test('tabs need bold labels before their content', async () => {
		expect(await errors('<!-- tabs -->\n\n```sh\nnpm i\n```\n\n<!-- /tabs -->')).toEqual([
			'<!-- tabs -->: content must start with a bold label line, e.g. **npm**'
		]);
	});

	test('passes tab variants to the renderer', async () => {
		const instances: unknown[] = [];
		await renderMarkdown({
			config,
			site,
			page: home(),
			t,
			source: '<!-- tabs -->\n\n**npm**\n\n`npm i`\n\n**bun**\n\n`bun add`\n\n<!-- /tabs -->',
			render: async (instance) => {
				instances.push(instance);
				return '';
			}
		});
		expect(instances).toMatchObject([
			{
				kind: 'component',
				props: {
					sync: 'npm|bun',
					panels: [
						{ label: 'npm', html: '<p><code>npm i</code></p>' },
						{ label: 'bun', html: '<p><code>bun add</code></p>' }
					]
				}
			}
		]);
	});
});

test('foreign components are recognized by a capitalized name, not by capitals alone', async () => {
	expect(await errors('<HStack gap="2">\n\ntext')).toHaveLength(1);
	expect(await errors('Promise<T> and one<BR>two')).toEqual([]);
});

test('only real HTML and headings are link targets, not code or comments', async () => {
	expect(await errors('<a id="real"></a>\n\n[x](#real)')).toEqual([]);
	expect(await errors('```html\n<p id="shown">\n```\n\n[x](#shown)')).toHaveLength(1);
	expect(await errors('<!-- TODO: an id="noted" -->\n\n[x](#noted)')).toHaveLength(1);
});

describe('built-in blocks', () => {
	const props = async (source: string) => {
		let found: Record<string, unknown> = {};
		const { diagnostics, titled } = await renderMarkdown({
			config,
			site,
			page: home(),
			source,
			t,
			render: async (instance) => {
				if (instance.kind === 'component') found = instance.props;
				return '<docs-island></docs-island>';
			}
		});
		return { props: found, titled, errors: diagnostics.map((diagnostic) => diagnostic.message) };
	};

	test('cards split at bold lines and keep a link in the title', async () => {
		const { props: cards } = await props(
			'<!-- cards -->\n\n**[Install](./10-guide/20-install.md)**\n\nOne command.\n\n**Typed**\n\n<!-- /cards -->'
		);
		expect(cards.cards).toEqual([
			{ title: '<a href="/fixture/guide/install/">Install</a>', html: '<p>One command.</p>' },
			{ title: 'Typed', html: '' }
		]);
		expect((await props('<!-- cards -->\n\ntext\n\n<!-- /cards -->')).errors).toEqual([
			'<!-- cards -->: start each card with a bold title line, e.g. **Fast**'
		]);
	});

	test('steps take one numbered list', async () => {
		expect((await props('<!-- steps -->\n\n1. One\n2. Two\n\n<!-- /steps -->')).errors).toEqual([]);
		const error = ['<!-- steps -->: put one numbered list inside, and nothing else'];
		expect((await props('<!-- steps -->\n\n- One\n\n<!-- /steps -->')).errors).toEqual(error);
		expect(
			(await props('<!-- steps -->\n\n1. One\n\n```sh\nx\n```\n\n<!-- /steps -->')).errors
		).toEqual(error);
	});

	test('a hero titles the page, turns a paragraph of links into buttons and sets its picture aside', async () => {
		const open =
			'<!-- hero -->\n\n# Title\n\nA [link](./index.md) in text.\n\n[Start](./index.md)\n\n';
		const { props: hero, titled, errors } = await props(`${open}<!-- /hero -->`);
		expect([titled, errors, hero.aside]).toEqual([true, [], undefined]);
		expect(hero.html).toContain('<p>A <a href="/fixture/">link</a> in text.</p>');
		expect(hero.html).toMatch(
			/<p class="[^"]*flex[^"]*"><a href="\/fixture\/" class="[^"]*bg-accent-700[^"]*">Start<\/a><\/p>/
		);
		for (const picture of ['```ts\nx\n```', '![d](./10-guide/diagram.svg)', '<!-- counter /-->']) {
			const { props: withPicture } = await props(`${open}${picture}\n\n<!-- /hero -->`);
			expect(withPicture.aside).toBeString();
			expect(withPicture.html).toEndWith('Start</a></p>');
		}
	});
});

describe('rewriteSourceLinks', () => {
	test('leaves code spans alone, follows links around images and survives a stray percent', () => {
		const rewrite = (source: string) => rewriteSourceLinks({ site, page: home(), source });
		expect(rewrite('`[a](./10-guide/20-install.md)` [b](./10-guide/20-install.md)')).toBe(
			'`[a](./10-guide/20-install.md)` [b](/fixture/guide/install.md)'
		);
		expect(rewrite('[![d](./10-guide/diagram.svg)](./10-guide/20-install.md)')).toBe(
			'[![d](/fixture/guide/diagram.svg)](/fixture/guide/install.md)'
		);
		expect(rewrite('[x](./100%-pure.md)')).toBe('[x](./100%-pure.md)');
	});

	test('points links at served Markdown and leaves code blocks alone', () => {
		const source =
			'[a](./10-guide/20-install.md#usage) ![d](./10-guide/diagram.svg)\n\n```md\n[b](./index.md)\n```';
		expect(rewriteSourceLinks({ site, page: home(), source, origin: 'https://x.dev' })).toBe(
			'[a](https://x.dev/fixture/guide/install.md#usage) ![d](https://x.dev/fixture/guide/diagram.svg)\n\n```md\n[b](./index.md)\n```'
		);
	});
});
