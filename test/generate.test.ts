import type { DocsConfig, Generator } from '../src/types.ts';

import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { build } from '../src/build.ts';
import { check } from '../src/check.ts';
import { resolveConfig } from '../src/config.ts';
import { dev } from '../src/dev.ts';
import { coalesce, runGenerators } from '../src/generate.ts';
import { guide } from '../src/guide.ts';
import { llmsTxt } from '../src/llms.ts';
import { scanSite } from '../src/pages.ts';

const roots: string[] = [];
afterAll(() => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

async function project(files: Record<string, string>) {
	const root = await mkdtemp(join(tmpdir(), 'svelte-edda-generate-'));
	roots.push(root);
	for (const [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

/** A generator that writes the given pages. */
const writes = (pages: Record<string, string>, extra: Partial<Generator> = {}): Generator => ({
	dir: 'api',
	description: 'Generated from src/. Edit the JSDoc instead.',
	run: async ({ outDir }) => {
		for (const [path, content] of Object.entries(pages)) {
			await mkdir(dirname(join(outDir, path)), { recursive: true });
			await writeFile(join(outDir, path), content);
		}
	},
	...extra
});

const config = (root: string, generate: Generator[], user: Partial<DocsConfig> = {}) =>
	resolveConfig(root, { title: 'Lib', generate, ...user });

const NOTICE =
	'<!-- Generated, do not edit by hand. Generated from src/. Edit the JSDoc instead. -->';

describe('generator config', () => {
	test('refuses a folder outside the docs directory, a missing description and a shared folder', async () => {
		const root = await project({ 'docs/index.md': '# Home\n' });
		expect(() => config(root, [writes({}, { dir: '../src' })])).toThrow(
			"a generator's `dir` must be a folder inside the docs directory"
		);
		expect(() => config(root, [writes({}, { description: ' ' })])).toThrow(
			'the generator for "api" needs a `description`'
		);
		expect(() => config(root, [writes({}), writes({}, { dir: 'api/types' })])).toThrow(
			'generators for "api" and "api/types" share a folder'
		);
		expect(() => config(root, [writes({})], { locales: { en: { label: 'English' } } })).toThrow(
			'a generator\'s `dir` starts with a language folder: "en/api"'
		);
	});
});

describe('runGenerators', () => {
	test('replaces the folder with fresh pages, each marked under its frontmatter', async () => {
		const root = await project({ 'docs/index.md': '# Home\n' });
		const first = config(root, [
			writes({ 'index.md': '---\ndescription: API\n---\n# API\n', 'old.md': '# Old\n' })
		]);
		expect(await runGenerators(first, 'write')).toEqual([]);
		expect(await readFile(join(root, 'docs/api/index.md'), 'utf8')).toBe(
			`---\ndescription: API\n---\n${NOTICE}\n\n# API\n`
		);

		// A page the generator no longer writes disappears with the next run.
		await runGenerators(config(root, [writes({ 'index.md': '# API\n' })]), 'write');
		expect(existsSync(join(root, 'docs/api/old.md'))).toBe(false);
		expect(await readFile(join(root, 'docs/api/index.md'), 'utf8')).toBe(`${NOTICE}\n\n# API\n`);
	});

	test('keeps the folder and rewrites only the pages that changed', async () => {
		const root = await project({ 'docs/index.md': '# Home\n' });
		const dir = join(root, 'docs/api');
		const pages = { 'a.md': '# A\n', 'b.md': '# B\n', 'guide/old.md': '# Old\n' };
		await runGenerators(config(root, [writes(pages)]), 'write');
		await chmod(dir, 0o750);
		const past = new Date('2020-01-01');
		await utimes(join(dir, 'a.md'), past, past);
		const mode = (await stat(dir)).mode;

		await runGenerators(config(root, [writes({ 'a.md': '# A\n', 'b.md': '# B2\n' })]), 'write');
		// The temporary output folder is 0700; copying it over would hand that mode on.
		expect((await stat(dir)).mode).toBe(mode);
		expect((await stat(join(dir, 'a.md'))).mtime).toEqual(past);
		expect(await readFile(join(dir, 'b.md'), 'utf8')).toBe(`${NOTICE}\n\n# B2\n`);
		expect(existsSync(join(dir, 'guide'))).toBe(false);
	});

	test('runs a shell command with the output directory in place of {outDir}', async () => {
		const root = await project({ 'docs/index.md': '# Home\n' });
		const generator = writes({}, { run: "printf '# CLI\\n' > {outDir}/cli.md" });
		expect(await runGenerators(config(root, [generator]), 'write')).toEqual([]);
		expect(await readFile(join(root, 'docs/api/cli.md'), 'utf8')).toBe(`${NOTICE}\n\n# CLI\n`);
	});

	test('reports a failing generator and keeps the pages it wrote before', async () => {
		const root = await project({ 'docs/index.md': '# Home\n' });
		await runGenerators(config(root, [writes({ 'index.md': '# API\n' })]), 'write');
		const failing = writes({}, { run: 'echo "TS2304: Cannot find name" >&2; exit 2' });
		const [diagnostic] = await runGenerators(config(root, [failing]), 'write');
		expect(diagnostic).toEqual({
			file: '.',
			message:
				'the generator for docs/api/ failed: `echo "TS2304: Cannot find name" >&2; exit 2` exited with code 2: TS2304: Cannot find name',
			severity: 'error'
		});
		expect(existsSync(join(root, 'docs/api/index.md'))).toBe(true);
	});

	test('leaves a folder with hand-written pages alone instead of deleting them', async () => {
		const root = await project({ 'docs/index.md': '# Home\n', 'docs/api/notes.md': '# Mine\n' });
		const diagnostics = await runGenerators(
			config(root, [writes({ 'index.md': '# API\n' })]),
			'write'
		);
		expect(diagnostics.map((diagnostic) => diagnostic.file)).toEqual(['docs/api/notes.md']);
		expect(diagnostics[0]!.message).toContain('was not written by a generator');
		expect(await readFile(join(root, 'docs/api/notes.md'), 'utf8')).toBe('# Mine\n');
	});
});

describe('check with committed pages', () => {
	const pages = { 'index.md': '# API\n\nSee [types](./types.md).\n', 'types.md': '# Types\n' };

	test('passes while the committed pages match and names each page that drifted', async () => {
		const root = await project({ 'docs/index.md': '# Home\n' });
		const committed = config(root, [writes(pages, { commit: true })]);
		await runGenerators(committed, 'write');
		// Only the warning about the missing `site` option is left.
		expect((await check(committed)).filter((d) => d.severity === 'error')).toEqual([]);

		await writeFile(join(root, 'docs/api/types.md'), `${NOTICE}\n\n# Types, edited\n`);
		await rm(join(root, 'docs/api/index.md'));
		await writeFile(join(root, 'docs/api/extra.md'), '# Extra\n');
		const problems = (await check(committed)).filter((d) => d.file.startsWith('docs/api/'));
		expect(problems.map((d) => [d.file, d.message.split(':')[0]])).toEqual([
			['docs/api/index.md', 'missing'],
			['docs/api/types.md', 'differs from what the generator writes'],
			[
				'docs/api/extra.md',
				'not written by the generator, so it does not belong in this folder. Generated from src/. Edit the JSDoc instead. Run `svelte-edda generate` and commit the result.'
			]
		]);
		// `check` compares committed pages; it never rewrites them.
		expect(existsSync(join(root, 'docs/api/index.md'))).toBe(false);
	});

	test('ignores hidden files and line endings changed by git', async () => {
		const root = await project({ 'docs/index.md': '# Home\n' });
		const committed = config(root, [writes(pages, { commit: true })]);
		await runGenerators(committed, 'write');
		await writeFile(join(root, 'docs/api/.DS_Store'), 'x');
		const file = join(root, 'docs/api/types.md');
		await writeFile(file, (await readFile(file, 'utf8')).replaceAll('\n', '\r\n'));
		expect(await runGenerators(committed, 'check')).toEqual([]);
	});

	test('writes uncommitted pages, so their links are checked too', async () => {
		const root = await project({ 'docs/index.md': '# Home\n' });
		const broken = writes({ 'index.md': '# API\n\n[Gone](./gone.md)\n' });
		const diagnostics = (await check(config(root, [broken]))).filter((d) => d.severity === 'error');
		expect(diagnostics.map((d) => [d.file, d.message])).toEqual([
			['docs/api/index.md', 'Broken link: ./gone.md (no page at docs/api/gone.md)']
		]);
	});
});

test('guide tells agents which folders are generated', async () => {
	const root = await project({ 'docs/index.md': '# Home\n' });
	expect(guide(config(root, [writes({}, { commit: true })]))).toContain(
		'- `docs/api/` is generated, never edit it: Generated from src/. Edit the JSDoc instead. `svelte-edda check` reports'
	);
});

test('build generates first and leaves generated pages without an edit link', async () => {
	const root = await project({
		'docs/index.md': '# Home\n',
		'docs/moved.md': '---\neditUrl: https://example.com/source.md\n---\n\n# Moved\n',
		'docs/noted.md': '<!-- prettier-ignore -->\n\n# Noted\n\nText.\n'
	});
	const outDir = join(root, 'dist');
	await build(
		config(root, [writes({ 'index.md': '# API\n' })], {
			repository: 'https://github.com/example/lib',
			outDir
		})
	);
	const edit = async (path: string) =>
		/data-testid="edit-link"[^>]*href="([^"]*)"|href="([^"]*)"[^>]*data-testid="edit-link"/
			.exec(await readFile(join(outDir, path), 'utf8'))
			?.slice(1)
			.find(Boolean);
	expect(await edit('api/index.html')).toBeUndefined();
	expect(await edit('moved/index.html')).toBe('https://example.com/source.md');
	expect(await edit('index.html')).toMatch(/^https:\/\/github\.com\/example\/lib\/edit\/main\//);

	// The notice above a generated page's heading, or a comment above a hand-written one, does not
	// make the layout add a second title.
	const h1s = async (path: string) =>
		(await readFile(join(outDir, path), 'utf8')).match(/<h1/g)?.length;
	expect(await h1s('api/index.html')).toBe(1);
	expect(await h1s('noted/index.html')).toBe(1);
}, 60_000);

test('llms.txt describes handwritten pages by their opening, generated ones only by frontmatter', async () => {
	const root = await project({
		'docs/index.md': '---\ndescription: Written.\n---\n\n# Home\n\nNot this.\n',
		'docs/opening.md':
			'# Opening\n\n[![npm](https://x.dev/x.svg)](https://x.dev)\n\n<!-- tabs -->\n\n**npm**\n\nx\n\n<!-- /tabs -->\n\n> Quoted.\n\nThe   **real**\nopening.\n'
	});
	const generator = writes({
		'index.md': '# API\n\nNone.\n',
		'a.md': '---\ndescription: From JSDoc.\n---\n\n# A\n'
	});
	const resolved = config(root, [generator]);
	await runGenerators(resolved, 'write');
	const index = await llmsTxt(resolved, await scanSite(resolved));
	expect(
		index
			.split('\n')
			.filter((line) => line.startsWith('- '))
			.slice(0, -1)
	).toEqual([
		'- [Home](/index.md): Written.',
		'- [API](/api.md)',
		'- [A](/api/a.md): From JSDoc.',
		'- [Opening](/opening.md): The real opening.'
	]);
});

test('coalesce runs once per burst and once more for a call during a run', async () => {
	let runs = 0;
	let release = () => {};
	const trigger = coalesce(async () => {
		runs++;
		await new Promise<void>((resolve) => (release = resolve));
	}, 10);
	trigger();
	trigger();
	trigger();
	await Bun.sleep(30);
	expect(runs).toBe(1);
	trigger();
	await Bun.sleep(30);
	expect(runs).toBe(1);
	release();
	await Bun.sleep(30);
	expect(runs).toBe(2);
	release();
});

test('dev generates again when a watched file changes', async () => {
	const root = await project({ 'docs/index.md': '# Home\n', 'src/api.txt': 'first' });
	const generator: Generator = {
		dir: 'api',
		description: 'Generated from src/api.txt.',
		watch: ['src'],
		run: async ({ outDir, root }) =>
			writeFile(
				join(outDir, 'index.md'),
				`# ${await readFile(join(root, 'src/api.txt'), 'utf8')}\n`
			)
	};
	const server = await dev(config(root, [generator]), { port: 0 });
	try {
		const address = server.httpServer!.address() as { port: number };
		const page = () =>
			fetch(`http://localhost:${address.port}/api/`).then((response) => response.text());
		expect(await page()).toContain('>first<');
		await writeFile(join(root, 'src/api.txt'), 'second');
		let html = '';
		for (let attempt = 0; attempt < 50 && !html.includes('>second<'); attempt++) {
			await Bun.sleep(100);
			html = await page();
		}
		expect(html).toContain('>second<');
	} finally {
		await server.close();
	}
}, 30_000);
