import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from '../src/build.ts';
import { check } from '../src/check.ts';
import { loadConfig, resolveConfig } from '../src/config.ts';
import { scanSites } from '../src/versions.ts';

// A throwaway repository: version 1 is tagged, then the docs move on.
const project = await mkdtemp(join(tmpdir(), 'svelte-edda-versions-'));
const git = (...args: string[]) =>
	execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
		cwd: project,
		stdio: 'pipe'
	});
const engine = JSON.stringify(join(import.meta.dir, '..', 'src', 'index.ts'));
const config = (versions: string) =>
	`import { defineConfig } from ${engine};\nexport default defineConfig({ title: 'Versioned', base: '/lib/', versions: ${versions} });\n`;
const read = (path: string) => readFile(join(project, 'dist', path), 'utf8');
let warnings: string[];

beforeAll(async () => {
	await mkdir(join(project, 'docs'), { recursive: true });
	await writeFile(join(project, 'svelte-edda.config.ts'), config('[]'));
	await writeFile(join(project, 'docs', 'index.md'), '# Home\n\nOld home.\n');
	await writeFile(
		join(project, 'docs', 'old-api.md'),
		'# Old API\n\nGone in 2.0. [Lost](./lost.md)\n'
	);
	git('init', '-q', '-b', 'main');
	git('add', '.');
	git('commit', '-q', '-m', 'v1');
	git('tag', 'v1.4.0');

	await rm(join(project, 'docs', 'old-api.md'));
	await writeFile(join(project, 'docs', 'index.md'), '# Home\n\nNew home.\n');
	await writeFile(
		join(project, 'svelte-edda.config.ts'),
		config(`[{ tag: 'v1.4.0', label: '1.x' }]`)
	);
	git('add', '.');
	git('commit', '-q', '-m', 'v2');

	warnings = (await build(await loadConfig(project))).warnings.map((warning) => warning.message);
}, 120_000);
afterAll(() => rm(project, { recursive: true, force: true }));

describe('archived versions', () => {
	test('the working tree is the latest version at the root', async () => {
		const home = await read('index.html');
		expect(home).toContain('New home.');
		expect(home).not.toContain('archived-banner');
		expect(home).toContain('data-pagefind-body');
	});

	test('a tag is built under /v/<slug>/ with its own pages', async () => {
		const home = await read('v/1.x/index.html');
		expect(home).toContain('Old home.');
		expect(home).toContain('You are reading the documentation for 1.x.');
		expect(home).toMatch(/href="\/lib\/"[^>]*>\s*Go to the latest version/);
		expect(home).not.toContain('data-pagefind-body');
		expect(await read('v/1.x/old-api/index.html')).toContain('Gone in 2.0.');
		expect(await read('v/1.x/old-api.md')).toContain('# Old API');
	});

	test('the version menu links to the same page in each version', async () => {
		const home = await read('index.html');
		expect(home).toContain('data-testid="version-menu"');
		expect(home).toMatch(/href="\/lib\/v\/1\.x\/"[^>]*>\s*1\.x/);
		// A page that no longer exists leads to that version's home page.
		expect(await read('v/1.x/old-api/index.html')).toMatch(/href="\/lib\/"[^>]*>\s*Latest/);
	});

	test('an archived page stays out of search engines and cannot fail the build', async () => {
		const page = await read('v/1.x/old-api/index.html');
		expect(page).toContain('<meta name="robots" content="noindex" />');
		expect(page).not.toContain('page-updated');
		expect(await read('index.html')).not.toContain('noindex');
		expect(warnings).toEqual([
			'Broken link: ./lost.md (no page at node_modules/.svelte-edda/versions/1.x-' +
				`${String(git('rev-parse', 'v1.4.0')).slice(0, 12)}/lost.md) (version 1.x)`
		]);
	});

	test('search and llms.txt cover the latest version only', async () => {
		expect(await read('llms.txt')).not.toContain('Old API');
		expect(existsSync(join(project, 'dist', 'v', '1.x', 'llms.txt'))).toBe(false);
	});

	test('check reports a missing tag', async () => {
		await writeFile(join(project, 'svelte-edda.config.ts'), config(`[{ tag: 'v0.9.0' }]`));
		const diagnostics = await check(await loadConfig(project));
		const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
		expect(errors.map((diagnostic) => diagnostic.message)).toEqual([
			'svelte-edda: git tag "v0.9.0" (version v0.9.0) not found'
		]);
	});
});

test('archives docs that sit at the root of the repository', async () => {
	const root = await mkdtemp(join(tmpdir(), 'svelte-edda-versions-root-'));
	const run = (...args: string[]) =>
		execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
			cwd: root,
			stdio: 'pipe'
		});
	try {
		await writeFile(join(root, 'index.md'), '# Home\n');
		run('init', '-q', '-b', 'main');
		run('add', '.');
		run('commit', '-q', '-m', 'v1');
		run('tag', 'v1');
		const resolved = resolveConfig(root, { title: 'Lib', docsDir: '.', versions: [{ tag: 'v1' }] });
		const { archived } = await scanSites(resolved);
		expect(archived[0]!.pages.map((page) => page.url)).toEqual(['/v/1/']);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
