import type { InlineConfig, Plugin, ViteDevServer } from 'vite';
import type { ModuleRunner } from 'vite/module-runner';
import type { ResolvedConfig } from './config.ts';
import type { Mode } from './render.ts';

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { isRunnableDevEnvironment } from 'vite';

import { engineRoot, engineSrc, isInside, toPosix } from './paths.ts';

const require = createRequire(join(engineRoot, 'package.json'));

/**
 * One Svelte runtime for the whole page. The engine, user components, live demos and the
 * documented library must share it, but with isolated installs (pnpm) the project root may not
 * see the engine's Svelte at all. The project's own Svelte wins, so a library's components run on
 * the version it is developed against; otherwise the engine's.
 */
function singleSvelte(config: ResolvedConfig): Plugin {
	return {
		name: 'svelte-edda:single-svelte',
		enforce: 'pre',
		async resolveId(id, _importer, options) {
			if (id !== 'svelte' && !id.startsWith('svelte/')) return null;
			for (const from of [config.root, engineRoot]) {
				const resolved = await this.resolve(id, join(from, 'package.json'), {
					...options,
					skipSelf: true
				});
				if (resolved) return resolved;
			}
			return null;
		}
	};
}

/**
 * vite-plugin-svelte asks the dependency optimizer to prebundle `svelte/*` from the project root.
 * When the root cannot see Svelte (pnpm, a project without Svelte) every entry fails with a
 * warning, though Svelte still loads from the engine through `singleSvelte`. Drop those entries.
 */
function quietOptimizer(config: ResolvedConfig): Plugin {
	// Walk node_modules like the optimizer does: `require.resolve` would also honour NODE_PATH,
	// which pnpm's command shims set and the optimizer ignores.
	const rootHasSvelte = (() => {
		for (let dir = config.root; ; dir = dirname(dir)) {
			if (existsSync(join(dir, 'node_modules', 'svelte', 'package.json'))) return true;
			if (dirname(dir) === dir) return false;
		}
	})();
	return {
		name: 'svelte-edda:quiet-optimizer',
		configResolved(resolved) {
			if (rootHasSvelte) return;
			const options = [
				resolved.optimizeDeps,
				...Object.values(resolved.environments).map((environment) => environment.optimizeDeps)
			];
			for (const optimizeDeps of options as { include?: string[] }[]) {
				optimizeDeps.include = optimizeDeps.include?.filter((id) => !/^svelte(\/|$| >)/.test(id));
			}
		}
	};
}

export function viteConfig(config: ResolvedConfig): InlineConfig {
	return {
		configFile: false,
		root: config.root,
		base: config.base,
		publicDir: config.publicDir ?? false,
		clearScreen: false,
		cacheDir: join(config.cacheDir, 'vite'),
		plugins: [
			singleSvelte(config),
			tailwindcss(),
			svelte({
				configFile: false,
				// A server-rendered component that never hydrates still needs its `<style>`: the server
				// render returns it in `head`, and the page carries it.
				dynamicCompileOptions: ({ compileOptions }) =>
					compileOptions.generate === 'server' ? { css: 'injected' } : undefined
			}),
			quietOptimizer(config)
		],
		ssr: { noExternal: ['svelte-edda'] },
		server: { fs: { allow: [config.root, engineRoot] } }
	};
}

export function ssrRunner(server: ViteDevServer): ModuleRunner {
	const environment = server.environments.ssr;
	if (!isRunnableDevEnvironment(environment))
		throw new Error('svelte-edda: the SSR environment is not runnable');
	return environment.runner;
}

export const generatedFiles = (config: ResolvedConfig) => ({
	css: join(config.cacheDir, 'entry.css'),
	client: join(config.cacheDir, 'client.js')
});

/**
 * Writes the CSS and client entries. Tailwind scans the engine, user components and demos;
 * user CSS comes last so its `@theme` overrides win.
 */
export async function writeGeneratedFiles(
	config: ResolvedConfig,
	mode: Mode,
	islands = new Map<string, string>()
) {
	const files = generatedFiles(config);
	await mkdir(join(config.cacheDir, 'demos'), { recursive: true });

	const quote = (path: string) => JSON.stringify(toPosix(path));
	const userComponentDirs = new Set(
		[...config.components.values()]
			.map((component) => dirname(component.component))
			.filter((dir) => !isInside(engineSrc, dir))
	);
	const css = [
		`@import ${quote(require.resolve('tailwindcss/index.css'))} source(none);`,
		`@plugin ${quote(require.resolve('@tailwindcss/typography'))};`,
		`@source ${quote(engineSrc)};`,
		`@source ${quote(join(config.cacheDir, 'demos'))};`,
		...[...userComponentDirs].map((dir) => `@source ${quote(dir)};`),
		`@import ${quote(join(engineSrc, 'theme', 'theme.css'))};`,
		...config.css.map((file) => `@import ${quote(file)};`)
	];
	await writeFile(files.css, `${css.join('\n')}\n`);

	const start = `import { start } from ${quote(join(engineSrc, 'client', 'main.ts'))};\n`;
	const client =
		mode === 'dev'
			? `${start}start({ base: ${JSON.stringify(config.base)}, load: (name, src) => import(/* @vite-ignore */ src) });\n`
			: `${start}const islands = {\n${[...islands]
					.map(([name, file]) => `  ${JSON.stringify(name)}: () => import(${quote(file)}),`)
					.join('\n')}\n};\n` +
				`start({\n  base: ${JSON.stringify(config.base)},\n  load: (name) => {\n    const load = islands[name];\n    if (!load) throw new Error(\`Unknown island: \${name}\`);\n    return load();\n  },\n});\n`;
	await writeFile(files.client, client);
	return files;
}
