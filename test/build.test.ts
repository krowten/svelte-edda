import { afterAll, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from '../src/build.ts';
import { loadConfig } from '../src/config.ts';

const outDir = await mkdtemp(join(tmpdir(), 'svelte-edda-build-'));
afterAll(() => rm(outDir, { recursive: true, force: true }));

test('builds a static site with islands, Markdown copies, llms files and a search index', async () => {
	const config = { ...(await loadConfig(join(import.meta.dir, 'fixtures', 'basic'))), outDir };
	const result = await build(config);
	expect(result.pages).toBe(6);

	const install = await readFile(join(outDir, 'guide', 'install', 'index.html'), 'utf8');
	expect(install).toContain('<docs-island data-name="tabs"');
	expect(install).toContain('data-testid="live-demo"');
	expect(install).toContain(
		'<link rel="alternate" type="text/markdown" href="/fixture/guide/install.md" />'
	);
	expect(install).toMatch(/<script type="module" src="\/fixture\/assets\/client-[\w-]+\.js">/);

	const home = await readFile(join(outDir, 'index.html'), 'utf8');
	// The home page is named after the site; its heading comes from the Markdown, once.
	expect(home).toContain('<title>Fixture</title>');
	expect(home.match(/<h1/g)).toHaveLength(1);
	expect(home).toContain('<h1 id="fixture-home">Fixture home</h1>');
	expect(home).toMatch(/<time datetime="\d{4}-\d\d-\d\d" data-testid="page-updated"/);

	// `title` names the document, `sidebar` the link to it, `layout: landing` drops the columns.
	const landing = await readFile(join(outDir, 'landing', 'index.html'), 'utf8');
	expect(landing).toContain('<title>Landing title | Fixture</title>');
	expect(landing).toContain('data-layout="landing"');
	expect(landing).not.toContain('<h1');
	expect(landing).not.toContain('data-testid="toc"');
	// A landing page ends with its own content.
	expect(landing).not.toContain('data-testid="edit-link"');
	expect(landing).not.toContain('data-testid="prev-page"');
	expect(home).toMatch(/href="\/fixture\/landing\/"[^>]*>\s*Start here/);
	expect(install).toContain('data-testid="toc"');

	// Without `site` nothing that needs an absolute URL is written.
	expect(home).not.toContain('application/ld+json');
	expect(home).not.toContain('rel="canonical"');
	expect(existsSync(join(outDir, 'robots.txt'))).toBe(false);
	expect(home).toContain('data-testid="badge" data-tone="new"');
	expect(home).toContain('<docs-island data-name="counter"');
	// A component that never hydrates still ships its scoped `<style>`.
	expect(home).toMatch(
		/<style[^>]*>[^<]*\.badge\.svelte-[\w-]+\s*\{\s*letter-spacing:\s*0\.0625em/
	);
	// The edit link is relative to the git repository, not to the directory of the config.
	expect(home).toContain(
		'href="https://github.com/example/fixture/edit/main/test/fixtures/basic/docs/index.md"'
	);

	expect(await readFile(join(outDir, 'index.md'), 'utf8')).toContain(
		'[install guide](/fixture/guide/install.md#usage)'
	);
	expect(await readFile(join(outDir, 'llms.txt'), 'utf8')).toContain(
		'- [Install](/fixture/guide/install.md)'
	);
	for (const file of [
		'404.html',
		'.nojekyll',
		'llms-full.txt',
		'pagefind/pagefind.js',
		'guide/diagram.svg'
	]) {
		expect(existsSync(join(outDir, file))).toBe(true);
	}
}, 120_000);

test('writes robots.txt for a site at the root of its own domain', async () => {
	const rootDir = await mkdtemp(join(tmpdir(), 'svelte-edda-root-'));
	try {
		const config = await loadConfig(join(import.meta.dir, 'fixtures', 'basic'));
		await build({ ...config, base: '/', site: 'https://docs.example.com', outDir: rootDir });
		expect(await readFile(join(rootDir, 'robots.txt'), 'utf8')).toBe(
			'User-agent: *\nAllow: /\n\nSitemap: https://docs.example.com/sitemap.xml\n'
		);
		const install = await readFile(join(rootDir, 'guide', 'install', 'index.html'), 'utf8');
		expect(install).toContain(
			'<link rel="canonical" href="https://docs.example.com/guide/install/" />'
		);
		expect(install).toMatch(/<script type="module" src="\/assets\/client-[\w-]+\.js">/);
	} finally {
		await rm(rootDir, { recursive: true, force: true });
	}
});

test('a logo takes the place of the title in the header and is named after the site', async () => {
	const logoDir = await mkdtemp(join(tmpdir(), 'svelte-edda-logo-'));
	try {
		const config = await loadConfig(join(import.meta.dir, 'fixtures', 'basic'));
		const src = join(logoDir, 'wordmark.svg');
		await writeFile(src, '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32"/>');
		await build({ ...config, logo: { src }, outDir: join(logoDir, 'out') });
		const home = await readFile(join(logoDir, 'out', 'index.html'), 'utf8');
		const link = home.match(/<a[^>]*data-testid="site-home"[^>]*>([\s\S]*?)<\/a>/)?.[1];
		expect(link).toMatch(/<img src="\/fixture\/_docs\/[^"]+" alt="Fixture"/);
		// Only the image: the name in text would repeat the wordmark next to it.
		expect(link?.replace(/<[^>]+>/g, '').trim()).toBe('');
	} finally {
		await rm(logoDir, { recursive: true, force: true });
	}
});
