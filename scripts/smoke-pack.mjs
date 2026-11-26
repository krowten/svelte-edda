/**
 * Pack the tarball and use it the way a consumer would.
 *
 * The tests run the engine from this repository, where its Svelte files, theme and client code
 * sit next to it. A consumer gets them from `node_modules`, where Vite must still compile them,
 * Tailwind must still scan them and every dependency must still resolve. This installs the
 * tarball into throwaway projects with npm, Bun and pnpm and builds a small site in each, with
 * the CLI running under Node.
 *
 * Run: `bun run smoke:pack`
 */
import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

// under `npm publish` (as `prepublishOnly`) npm hands its own config down, `dry_run` included,
// which would turn the nested pack and install into no-ops; a consumer has none of it
const env = Object.fromEntries(
	Object.entries(process.env).filter(([name]) => !/^npm_/i.test(name))
);

const run = (command, args, cwd) =>
	execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const FILES = {
	'package.json': JSON.stringify({ name: 'smoke', private: true, type: 'module' }, null, 2),
	'svelte-edda.config.js': `import { defineComponent, defineConfig, svelteComponents } from 'svelte-edda';

export default defineConfig({
	title: 'Smoke',
	base: '/smoke/',
	generate: [svelteComponents({ dir: 'api', components: ['components/*.svelte'] })],
	components: [defineComponent({ name: 'counter', component: 'components/Counter.svelte', interactive: true })]
});
`,
	// type-checked, not built: the published types under a consumer's own compiler settings
	'types.ts': `import type { Generator, PrepareContext } from 'svelte-edda';

import { defineComponent, defineConfig, svelteComponents } from 'svelte-edda';

const generator: Generator = { dir: 'api', description: 'x', run: ({ outDir }) => void outDir };

export default defineConfig({
	title: 'Types',
	generate: [generator, svelteComponents({ dir: 'ui', components: ['src'], exclude: ['src/x'] })],
	components: [
		defineComponent({
			name: 'a',
			component: 'A.svelte',
			prepare: ({ children, lang }: PrepareContext) => {
				for (const node of children) if (node.type === 'element') node.tagName.toUpperCase();
				// @ts-expect-error a node is no string: the type has not collapsed into any
				const text: string = children[0];
				return { lang, text };
			}
		})
	]
});
`,
	'tsconfig.json': JSON.stringify({
		compilerOptions: {
			strict: true,
			noEmit: true,
			types: [],
			exactOptionalPropertyTypes: true,
			noPropertyAccessFromIndexSignature: true
		},
		files: ['types.ts']
	}),
	'components/Counter.svelte': `<script>
	let count = $state(0);
</script>

<button class="text-emerald-600" onclick={() => count++}>Clicked {count}</button>
`,
	'docs/index.md': `# Smoke

See [the guide](./guide.md).

> [!NOTE]
> An alert.

<!-- tabs -->

**npm**

\`\`\`sh
npm install smoke
\`\`\`

**bun**

\`\`\`sh
bun add smoke
\`\`\`

<!-- /tabs -->

<!-- counter /-->

\`\`\`svelte live
<script>
	let on = $state(false);
</script>

<button class="text-sky-600" onclick={() => (on = !on)}>{on ? 'on' : 'off'}</button>
\`\`\`
`,
	'docs/guide.md': '# Guide\n\nA second page.\n'
};

const INSTALLERS = {
	npm: (tarball) => ['npm', ['install', tarball, '--no-audit', '--no-fund', '--silent']],
	bun: (tarball) => ['bun', ['add', tarball]],
	// isolated node_modules: only direct dependencies are visible from the project root
	pnpm: (tarball) => ['npx', ['--yes', 'pnpm@latest', 'add', tarball]]
};

const expect = (condition, message) => {
	if (!condition) throw new Error(message);
	console.log(`  ok  ${message}`);
};

const dir = mkdtempSync(path.join(tmpdir(), 'svelte-edda-smoke-'));
try {
	console.log('packing…');
	const packed = run('npm', ['pack', '--pack-destination', dir, '--silent'], root)
		.trim()
		.split('\n')
		.at(-1);
	const tarball = path.join(dir, packed);

	for (const [name, installer] of Object.entries(INSTALLERS)) {
		const project = path.join(dir, name);
		for (const [file, content] of Object.entries(FILES)) {
			mkdirSync(path.dirname(path.join(project, file)), { recursive: true });
			writeFileSync(path.join(project, file), content);
		}

		console.log(`installing ${packed} with ${name}…`);
		const [command, args] = installer(tarball);
		run(command, args, project);

		console.log(`building with ${pkg.name}@${pkg.version} under Node:`);
		// through the installed command, as users run it: catches a `bin` npm dropped from the manifest
		run(path.join(project, 'node_modules', '.bin', 'svelte-edda'), ['build'], project);

		// outside this repository, so that only the package's own dependencies resolve
		for (const [module, moduleResolution] of [
			['nodenext', 'nodenext'],
			['esnext', 'bundler']
		]) {
			run(
				process.execPath,
				[
					path.join(root, 'node_modules/typescript/bin/tsc'),
					...['-p', '.'],
					...['--module', module, '--moduleResolution', moduleResolution, '--target', 'es2022']
				],
				project
			);
			console.log(`  ok  ${name}: types resolve with ${moduleResolution}`);
		}

		const out = path.join(project, 'dist');
		const html = readFileSync(path.join(out, 'index.html'), 'utf8');
		expect(html.includes('<docs-island data-name="tabs"'), `${name}: tabs rendered as an island`);
		expect(
			html.includes('<docs-island data-name="counter"'),
			`${name}: user component rendered as an island`
		);
		expect(html.includes('data-testid="live-demo"'), `${name}: live demo rendered`);
		expect(html.includes('data-alert="note"'), `${name}: alert rendered`);
		expect(html.includes('href="/smoke/guide/"'), `${name}: page link rewritten`);
		const css = readdirSync(path.join(out, 'assets'))
			.filter((file) => file.endsWith('.css'))
			.map((file) => readFileSync(path.join(out, 'assets', file), 'utf8'))
			.join('\n');
		expect(css.includes('.text-emerald-600'), `${name}: Tailwind scanned the user component`);
		expect(css.includes('.text-sky-600'), `${name}: Tailwind scanned the live demo`);
		expect(css.includes('.bg-accent-'), `${name}: Tailwind scanned the engine theme`);
		for (const file of [
			'guide/index.html',
			'api/counter/index.html',
			'index.md',
			'llms.txt',
			'llms-full.txt',
			'404.html',
			'pagefind/pagefind.js'
		]) {
			expect(existsSync(path.join(out, file)), `${name}: ${file} written`);
		}
	}
	console.log('tarball is consumable ✓');
} finally {
	rmSync(dir, { recursive: true, force: true });
}
