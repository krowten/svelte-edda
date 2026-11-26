#!/usr/bin/env node
import type { Plugin } from 'vite';

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { preview } from 'vite';

import { BuildError, build } from './build.ts';
import { check } from './check.ts';
import { loadConfig } from './config.ts';
import { dev } from './dev.ts';
import { runGenerators } from './generate.ts';
import { guide } from './guide.ts';
import { formatDiagnostic } from './markdown/index.ts';
import { engineRoot } from './paths.ts';

const HELP = `Usage: svelte-edda <command> [options]

Commands:
  dev       Start the dev server
  build     Build the static site into the output directory
  preview   Serve the built site
  check     Validate component markers, attributes, alerts, links and live demos
  guide     Print how to write this project's docs: syntax and components
  generate  Run the generators of the config and write their pages

Options:
  --root <dir>    Project root with svelte-edda.config.ts (default: current directory)
  --port <port>   Server port (dev, preview)
  --host [host]   Listen on all addresses, or on the given one (dev, preview)
  -h, --help      Show this help
  -v, --version   Show the version
`;

/** Unknown URLs get the site's 404.html, as on GitHub Pages. */
function notFoundPage(outDir: string, base: string): Plugin {
	return {
		name: 'svelte-edda:not-found',
		configurePreviewServer(server) {
			return () => {
				server.middlewares.use((req, res, next) => {
					const url = (req as typeof req & { originalUrl?: string }).originalUrl ?? req.url ?? '/';
					const path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
					const file = join(outDir, path.startsWith(base) ? path.slice(base.length) : path);
					// Directories resolve to their index.html further down the stack.
					if (existsSync(file) || existsSync(join(file, 'index.html'))) return next();
					res.statusCode = 404;
					res.setHeader('Content-Type', 'text/html; charset=utf-8');
					res.end(readFileSync(join(outDir, '404.html')));
				});
			};
		}
	};
}

async function main() {
	// parseArgs has no options with an optional value: a bare `--host` becomes an empty one.
	const args = process.argv
		.slice(2)
		.map((arg, index, all) =>
			arg === '--host' && (all[index + 1] ?? '-').startsWith('-') ? '--host=' : arg
		);
	const { positionals, values } = parseArgs({
		args,
		allowPositionals: true,
		options: {
			root: { type: 'string' },
			port: { type: 'string' },
			host: { type: 'string' },
			help: { type: 'boolean', short: 'h' },
			version: { type: 'boolean', short: 'v' }
		}
	});
	if (values.version) {
		const manifest = readFileSync(join(engineRoot, 'package.json'), 'utf8');
		console.log((JSON.parse(manifest) as { version: string }).version);
		return;
	}
	const command = positionals[0];
	if (values.help || !command) {
		process.stdout.write(HELP);
		return;
	}

	const config = await loadConfig(resolve(values.root ?? '.'));
	const port = values.port ? Number(values.port) : undefined;
	if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port <= 65535)) {
		throw new Error(`svelte-edda: --port must be a number from 0 to 65535, got "${values.port}"`);
	}
	const host = values.host === '' ? true : values.host;

	switch (command) {
		case 'dev':
			await dev(config, { port, host });
			return;
		case 'build': {
			const started = performance.now();
			const result = await build(config);
			for (const warning of result.warnings) console.warn(formatDiagnostic(warning));
			const seconds = ((performance.now() - started) / 1000).toFixed(1);
			console.log(`Built ${result.pages} page(s) into ${config.outDir} in ${seconds}s`);
			return;
		}
		case 'preview': {
			if (!existsSync(join(config.outDir, '404.html'))) {
				throw new Error(`svelte-edda: nothing to preview in ${config.outDir}; run the build first`);
			}
			const server = await preview({
				configFile: false,
				root: config.root,
				base: config.base,
				appType: 'mpa',
				build: { outDir: config.outDir },
				preview: { port, host },
				plugins: [notFoundPage(config.outDir, config.base)]
			});
			server.printUrls();
			return;
		}
		case 'check': {
			const diagnostics = await check(config);
			for (const diagnostic of diagnostics) console.log(formatDiagnostic(diagnostic));
			const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
			console.log(
				errors === 0
					? 'No errors found.'
					: `${errors} error(s) found. \`svelte-edda guide\` prints the syntax of this project's docs.`
			);
			process.exitCode = errors === 0 ? 0 : 1;
			return;
		}
		case 'guide':
			process.stdout.write(guide(config));
			return;
		case 'generate': {
			const diagnostics = await runGenerators(config, 'write');
			for (const diagnostic of diagnostics) console.error(formatDiagnostic(diagnostic));
			if (diagnostics.length > 0) process.exitCode = 1;
			else console.log(`Ran ${config.generate.length} generator(s).`);
			return;
		}
		default:
			process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
			process.exitCode = 1;
	}
}

main().catch((error: unknown) => {
	if (error instanceof BuildError) {
		for (const diagnostic of error.diagnostics) console.error(formatDiagnostic(diagnostic));
		console.error(error.message);
	} else {
		console.error(error);
	}
	process.exitCode = 1;
});
