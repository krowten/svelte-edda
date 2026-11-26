import type { ResolvedConfig } from '../src/config.ts';
import type { Site } from '../src/pages.ts';

import { beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BuildError, build } from '../src/build.ts';
import { loadConfig, resolveConfig } from '../src/config.ts';
import { guide } from '../src/guide.ts';
import { createTranslator } from '../src/i18n/translator.ts';
import { renderMarkdown } from '../src/markdown/index.ts';
import { scanSite } from '../src/pages.ts';

// What an author who has never seen the engine gets wrong, and what they are told.

let config: ResolvedConfig;
let site: Site;

beforeAll(async () => {
	config = await loadConfig(join(import.meta.dir, 'fixtures', 'basic'));
	site = await scanSite(config);
});

const t = createTranslator('en');
const diagnostics = async (source: string) =>
	(
		await renderMarkdown({ config, site, page: site.byUrl.get('/fixture/')!, source, t })
	).diagnostics.map((diagnostic) => `${diagnostic.line}: ${diagnostic.message}`);

describe('syntax of other documentation tools', () => {
	test('is an error that says what to write instead', async () => {
		const found = await diagnostics(
			[
				':::tip\nText\n:::',
				'<Tabs>\n<TabItem label="npm">x</TabItem>\n</Tabs>',
				'{% hint style="info" %}',
				':::badge\nx\n:::'
			].join('\n\n')
		);
		expect(found).toEqual([
			'1: :::tip is not read as a component: write an alert, > [!NOTE] (or TIP, IMPORTANT, WARNING, CAUTION). To show it as text, put it in a code span.',
			'5: <Tabs> is not read as a component: write <!-- tabs --> … <!-- /tabs --> with a bold label line such as **npm** before each variant. To show it as text, put it in a code span.',
			'9: {% hint %} is not read as a component: components are comment markers such as <!-- tabs --> … <!-- /tabs -->, listed by `svelte-edda guide`. To show it as text, put it in a code span.',
			'11: :::badge is not read as a component: write <!-- badge --> … <!-- /badge -->. To show it as text, put it in a code span.'
		]);
	});

	test('is left alone in code, when escaped and in ordinary HTML', async () => {
		const found = await diagnostics(
			[
				'Write `:::tip`, `<Tabs>` or `{% tabs %}` elsewhere; here \\:::tip and \\{% x %} are text.',
				'```md\n:::tip\n<Tabs>\n```',
				'<details>\n<summary>More</summary>\n\nText\n\n</details>',
				'<!-- TODO: explain <Tabs> -->',
				'A ratio of 3:::1 and a set {%}.'
			].join('\n\n')
		);
		expect(found).toEqual([]);
	});
});

describe('alerts', () => {
	test('an unknown type is an error, the known ones match in any case', async () => {
		expect(await diagnostics('> [!WARN]\n> Careful.')).toEqual([
			'1: Unknown alert [!WARN]: use NOTE, TIP, IMPORTANT, WARNING or CAUTION'
		]);
		expect(await diagnostics('> [!note]\n> Fine.\n\n> A quote with [brackets].')).toEqual([]);
	});
});

describe('anchors', () => {
	test('must be a heading or an id of the page they point to', async () => {
		const found = await diagnostics(
			[
				'## Set up',
				'[a](#set-up) [b](#setup) [c](./10-guide/20-install.md#usage) [d](./10-guide/20-install.md#usege)',
				'<a id="old-name"></a> [e](#old-name) [f](#:~:text=phrase) [g](#)'
			].join('\n\n')
		);
		expect(found).toEqual([
			'3: Broken link: #setup (no heading or id "setup" on this page)',
			'3: Broken link: ./10-guide/20-install.md#usege (no heading or id "usege" in docs/10-guide/20-install.md)'
		]);
	});
});

describe('markers', () => {
	test('one that is never closed gives one error, in line order with the rest', async () => {
		const found = await diagnostics(
			'> [!WARN]\n> x\n\n<!-- tabs -->\n\nNo label here.\n\n## Later\n\n[x](./nope.md)'
		);
		expect(found).toEqual([
			'1: Unknown alert [!WARN]: use NOTE, TIP, IMPORTANT, WARNING or CAUTION',
			'4: <!-- tabs --> is never closed with <!-- /tabs -->',
			'10: Broken link: ./nope.md (no page at docs/nope.md)'
		]);
	});
});

describe('live demos', () => {
	test('one that does not compile is reported at its line and stays a code block', async () => {
		const source = 'Text.\n\n```svelte live\n<p>fine</p>\n<button>{broken</button>\n```';
		const rendered = await renderMarkdown({
			config,
			site,
			page: site.byUrl.get('/fixture/')!,
			source,
			t
		});
		expect(rendered.diagnostics).toMatchObject([
			{
				line: 5,
				severity: 'error',
				message: expect.stringMatching(/^Live demo does not compile: /)
			}
		]);
		expect(rendered.html).toContain('<pre');
	});

	test('one that fails while rendering fails the build with its place in the Markdown', async () => {
		const root = await mkdtemp(join(tmpdir(), 'svelte-edda-authoring-'));
		try {
			await mkdir(join(root, 'docs'));
			await writeFile(
				join(root, 'docs', 'index.md'),
				"# Home\n\n```svelte live\n<script>\n\timport Missing from './missing.svelte';\n</script>\n\n<Missing />\n```\n"
			);
			const failure = await build(resolveConfig(root, { title: 'Broken' })).catch(
				(error: unknown) => error
			);
			expect(failure).toBeInstanceOf(BuildError);
			expect((failure as BuildError).diagnostics).toMatchObject([
				{
					file: 'docs/index.md',
					line: 3,
					message: expect.stringMatching(/^Live demo failed to render: /)
				}
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 60_000);
});

describe('guide', () => {
	// Blocks fenced with four backticks, some indented inside a list.
	const examples = (text: string) =>
		[...text.matchAll(/^( *)````md\n([\s\S]*?)\n\1````$/gm)].map((match) =>
			match[2]!.replaceAll(new RegExp(`^${match[1]}`, 'gm'), '')
		);

	test('lists the project components with attributes and examples', () => {
		const text = guide(config);
		expect(text).toContain('# Writing the documentation of Fixture');
		expect(text).toContain('### tabs');
		expect(text).toContain('<!-- badge tone="info" -->');
		expect(text).toContain('- `tone` (required; info | new)');
		expect(text).toContain('A button that counts its clicks.\n\n````md\n<!-- counter /-->\n````');
	});

	test('every example it shows passes the checker', async () => {
		const shown = examples(guide(config));
		expect(shown.length).toBeGreaterThan(3);
		for (const example of shown) expect(await diagnostics(example)).toEqual([]);
	});

	test('describes language folders and versions when the project has them', async () => {
		const text = guide(await loadConfig(join(import.meta.dir, 'fixtures', 'i18n')));
		expect(text).toContain('One folder per language: `docs/en/`, `docs/ru/`, `docs/fr/`.');
		expect(text).toContain('`docs/en/guide/install.md` is served at `/guide/install/`');
	});

	test('tells where the sidebar order lives', async () => {
		const automatic = guide(config);
		expect(automatic).toContain('A numeric prefix orders the sidebar');
		// A project still on numbers learns that the menu can live in the config.
		expect(automatic).toContain('list them in a `sidebar` option of `svelte-edda.config.ts`');
		expect(automatic).toContain('Header links go into a `nav` option');
		const configured = guide(await loadConfig(join(import.meta.dir, 'fixtures', 'i18n')));
		expect(configured).toContain('The sidebar is listed in `sidebar` of `svelte-edda.config.ts`');
		expect(configured).not.toContain('A numeric prefix');
		expect(configured).toContain(
			"`{ en: '…', ru: '…', fr: '…' }`; `check` warns about a missing one"
		);
	});

	test('tells component authors about the page language', () => {
		expect(guide(config)).toContain('it gets `lang`, the language of the page');
	});
});
