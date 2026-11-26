import { afterAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { check } from '../src/check.ts';
import { resolveConfig } from '../src/config.ts';
import { runGenerators } from '../src/generate.ts';
import { svelteComponents } from '../src/index.ts';

const roots: string[] = [];
afterAll(() => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

/** Generates the pages of the given sources and returns a reader of them. */
async function generated(
	files: Record<string, string>,
	components = ['src'],
	exclude: string[] = []
) {
	const root = await mkdtemp(join(tmpdir(), 'svelte-edda-components-'));
	roots.push(root);
	for (const [path, content] of Object.entries({ 'docs/index.md': '# Home\n', ...files })) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	const config = resolveConfig(root, {
		title: 'Lib',
		generate: [svelteComponents({ dir: 'components', components, exclude })]
	});
	const errors = (await runGenerators(config, 'write')).map((diagnostic) => diagnostic.message);
	const page = (path: string) => readFile(join(root, 'docs/components', path), 'utf8');
	const rows = async (path: string, section = 'Props') =>
		(await page(path))
			.split(`## ${section}\n`)[1]!
			.split('\n## ')[0]!
			.split('\n')
			.filter((line) => line.startsWith('| `'));
	return { config, errors, page, rows };
}

describe('svelteComponents', () => {
	test('lists props with types, defaults, comments and bindings, snippets and exports apart', async () => {
		const { errors, page, rows, config } = await generated({
			'src/TextField.svelte': `<!--
	@component
	A field. See [forms](https://x.dev).

	- one
	  - two
-->
<script lang="ts" generics="T extends string">
	type Props = {
		/** Current value. */
		value?: T;
		/**
		 * Kind of {@link Field}, a | b.
		 * @default never read
		 */
		kind: 'text' | 'email';
		/** @deprecated use kind */
		'data-type'?: string;
		onsave?(value: string, at: Date): void;
		/** A row. */
		row?: Snippet<[{ id: number }]>;
	};
	let { value = $bindable('a' as T), kind, 'data-type': type = \`x\`, onsave, row }: Props = $props();
	/** Moves focus. */
	export function focus(options?: FocusOptions): void {}
</script>
`
		});
		expect(errors).toEqual([]);
		expect(await rows('text-field.md')).toEqual([
			"| `value` (bindable) | `T` | no | `'a' as T` | Current value. |",
			"| `kind` | `'text' \\| 'email'` | yes |  | Kind of `Field`, a \\| b. |",
			'| `data-type` | `string` | no | `` `x` `` | **Deprecated.** use kind |',
			'| `onsave` | `(value: string, at: Date) => void` | no |  |  |'
		]);
		expect(await rows('text-field.md', 'Snippets')).toEqual([
			'| `row` | `Snippet<[{ id: number }]>` | no | A row. |'
		]);
		expect(await rows('text-field.md', 'Exports')).toEqual([
			'| `focus` | `(options?: FocusOptions) => void` | Moves focus. |'
		]);
		const text = await page('text-field.md');
		expect(text).toContain('title: "TextField"\ndescription: "A field. See forms."');
		expect(text).toContain('A field. See [forms](https://x.dev).\n\n- one\n  - two\n');
		expect(text).toContain('Type parameters: `T extends string`.');
		expect(await page('index.md')).toContain('- [TextField](./text-field.md): A field. See forms.');
		expect((await check(config)).filter((d) => d.severity === 'error')).toEqual([]);
	});

	test('follows types through imports, re-exports, $lib and extends', async () => {
		const { rows, page } = await generated(
			{
				'src/lib/A.svelte': `<script lang="ts">
	import type { Renamed as AProps } from '$lib/types';
	let { size = 'm', own }: AProps = $props();
</script>`,
				'src/lib/types/index.ts': `export * from './more.js';\nexport type { Base as Renamed } from './base';`,
				'src/lib/types/base.ts': `import type { HTMLAttributes } from 'svelte/elements';
import type { Sized } from './more';
export interface Base extends Sized, Omit<HTMLAttributes<HTMLElement>, 'title'> { /** Own. */ own: number; size?: 's' | 'm' }`,
				'src/lib/types/more.ts': `export type Sized = { size: string } & (Colored);\ntype Colored = { color?: string };`
			},
			['src/lib']
		);
		expect(await rows('a.md')).toEqual([
			'| `own` | `number` | yes |  | Own. |',
			"| `size` | `'s' \\| 'm'` | no | `'m'` |  |",
			'| `color` | `string` | no |  |  |'
		]);
		expect(await page('a.md')).toContain(
			"Also takes the props of `Omit<HTMLAttributes<HTMLElement>, 'title'>`."
		);
	});

	test('never guesses: a prop without a type in reach has none, and is not called required', async () => {
		const { rows, page } = await generated({
			'src/A.svelte': `<script lang="ts">
	import type { Props } from 'some-package';
	let { a, b = 1, ...rest }: Props = $props();
</script>`,
			'src/B.svelte': `<script>
	let { /** Said here. */ a, ...rest } = $props();
</script>`,
			'src/C.svelte': '<p>Static</p>',
			'src/D.svelte': '<script lang="ts">let { a, ...rest }: { a: 1; b: 2 } = $props();</script>'
		});
		expect(await rows('a.md')).toEqual(['| `a` |  |  |  |  |', '| `b` |  | no | `1` |  |']);
		expect(await page('a.md')).toContain('Also takes the props of `Props`.');
		expect(await rows('b.md')).toEqual(['| `a` |  |  |  | Said here. |']);
		expect(await page('b.md')).toContain('Also takes props that are not listed here.');
		expect(await page('c.md')).toEndWith('## Props\n\nNone.\n');
		// A type in reach says all there is: the rest is `b`.
		expect(await rows('d.md')).toEqual(['| `a` | `1` | yes |  |  |', '| `b` | `2` | yes |  |  |']);
		expect(await page('d.md')).not.toContain('Also takes');
	});

	test('survives types that refer to themselves and modules it cannot read', async () => {
		const { errors, rows } = await generated({
			'src/A.svelte': `<script lang="ts">
	import type { Loop } from './loop';
	import type { Broken } from './broken';
	let { a }: Loop & Broken = $props();
</script>`,
			'src/loop.ts': `import type { Loop as Back } from './loop';\nexport interface Loop extends Back { a: string }`,
			'src/broken.ts': 'export type Broken = {{{'
		});
		expect(errors).toEqual([]);
		expect(await rows('a.md')).toEqual(['| `a` | `string` | yes |  |  |']);
	});

	test('keeps folders, and refuses `export let`, shared pages and an empty set', async () => {
		const { page } = await generated({
			'src/form/Input.svelte': '<input />',
			'src/_Own.svelte': ''
		});
		expect(await page('index.md')).toEndWith('# Components\n\n- [Input](./form/input.md)\n');

		const failure = async (...args: Parameters<typeof generated>) =>
			(await generated(...args)).errors[0];
		expect(await failure({ 'src/Old.svelte': '<script>export let a;</script>' })).toContain(
			'src/Old.svelte declares props with `export let`'
		);
		expect(
			await failure({ 'src/a/X.svelte': '', 'src/b/X.svelte': '' }, ['src/a', 'src/b'])
		).toContain('X.svelte and src/a/X.svelte would share the page x.md');
		expect(await failure({ 'src/Index.svelte': '' })).toContain('and the index page would share');
		expect(await failure({ 'src/a.ts': '' })).toContain('no .svelte files in src');
	});

	test('takes files, folders and masks, and leaves out what is excluded', async () => {
		const files = Object.fromEntries(
			['Button', 'ui/Card', 'ui/CardPart', 'ui/internal/Portal', 'demo/Demo'].map((name) => [
				`src/${name}.svelte`,
				''
			])
		);
		const listed = async (components: string[], exclude?: string[]) => {
			const { errors, page } = await generated(files, components, exclude);
			if (errors.length > 0) return errors;
			return [...(await page('index.md')).matchAll(/\(\.\/(.*)\.md\)/g)].map((match) => match[1]);
		};
		expect(await listed(['src'], ['src/demo', 'src/ui/CardPart.svelte', '**/internal/**'])).toEqual(
			['button', 'ui/card']
		);
		expect(await listed(['src/ui/*.svelte', 'src/Button.svelte'])).toEqual([
			'card',
			'card-part',
			'button'
		]);
		// Named by its folder and by a mask, a component is still one page.
		expect(await listed(['src/ui', 'src/**/Card.svelte'])).toEqual([
			'card',
			'card-part',
			'internal/portal'
		]);
		expect((await listed(['src'], ['src/gone']))[0]).toContain(
			'`exclude` names src/gone, but there is no src/gone'
		);
		expect((await listed(['src'], ['src/**']))[0]).toContain('no .svelte files in src');
	});

	test('watches the folder a mask starts in', () => {
		const { watch } = svelteComponents({ dir: 'c', components: ['a/B.svelte', 'src/**/*.svelte'] });
		expect(watch).toEqual(['a/B.svelte', 'src']);
	});
});
