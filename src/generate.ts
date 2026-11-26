import type { ResolvedConfig, ResolvedGenerator } from './config.ts';
import type { Diagnostic } from './markdown/index.ts';

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { toPosix } from './paths.ts';

const fromRoot = (config: ResolvedConfig, path: string) => toPosix(relative(config.root, path));

const NOTICE = '<!-- Generated, do not edit by hand.';

/** The first line of every generated page, under its frontmatter. GitHub does not show it. */
export const notice = (generator: ResolvedGenerator) => `${NOTICE} ${generator.description} -->`;

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

const isGenerated = (source: string) =>
	source.slice(FRONTMATTER.exec(source)?.[0].length ?? 0).startsWith(NOTICE);

/** Pages in a generated folder that no generator wrote: replacing the folder would delete them. */
async function handWritten(
	config: ResolvedConfig,
	generator: ResolvedGenerator
): Promise<string[]> {
	const pages = (await filesIn(generator.dir)).filter((file) => file.endsWith('.md'));
	const sources = await Promise.all(
		pages.map((file) => readFile(join(generator.dir, file), 'utf8'))
	);
	return pages
		.filter((_, index) => !isGenerated(sources[index]!))
		.map((file) => fromRoot(config, join(generator.dir, file)));
}

function mark(source: string, generator: ResolvedGenerator): string {
	const head = FRONTMATTER.exec(source)?.[0] ?? '';
	return `${head}${notice(generator)}\n\n${source.slice(head.length).replace(/^(?:[ \t]*\r?\n)+/, '')}`;
}

type Entry = { path: string; name: string; dir: boolean };

/** Everything under `dir`, hidden files included, as paths relative to it; none when it does not exist. */
async function entriesIn(dir: string): Promise<Entry[]> {
	try {
		const entries = await readdir(dir, { recursive: true, withFileTypes: true });
		return entries.map((entry) => ({
			path: toPosix(relative(dir, join(entry.parentPath, entry.name))),
			name: entry.name,
			dir: entry.isDirectory()
		}));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
}

/** Files under `dir` as paths relative to it, with `/`; none when it does not exist. */
const filesIn = async (dir: string) =>
	(await entriesIn(dir))
		// Hidden files such as .DS_Store are no pages.
		.filter((entry) => !entry.dir && !entry.name.startsWith('.'))
		.map((entry) => entry.path)
		.sort();

/**
 * Makes `to` hold exactly what `from` holds. The folder itself is kept, so it keeps its mode and
 * owner, and a file is written only when its bytes changed, so watchers see only real changes.
 */
async function sync(from: string, to: string): Promise<void> {
	const [fresh, old] = await Promise.all([entriesIn(from), entriesIn(to)]);
	const kinds = new Map(fresh.map((entry) => [entry.path, entry.dir]));
	for (const entry of old) {
		if (kinds.get(entry.path) !== entry.dir) {
			await rm(join(to, entry.path), { recursive: true, force: true });
		}
	}
	await mkdir(to, { recursive: true });
	for (const entry of fresh) {
		const target = join(to, entry.path);
		if (entry.dir) {
			await mkdir(target, { recursive: true });
			continue;
		}
		await mkdir(dirname(target), { recursive: true });
		const content = await readFile(join(from, entry.path));
		const before = await readFile(target).catch(() => undefined);
		if (!before?.equals(content)) await writeFile(target, content);
	}
}

function shell(command: string, cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'ignore', 'pipe'] });
		let stderr = '';
		child.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));
		child.on('error', reject);
		child.on('close', (code) =>
			code === 0
				? resolve()
				: reject(
						new Error(
							`\`${command}\` exited with code ${code}${stderr.trim() ? `: ${stderr.trim()}` : ''}`
						)
					)
		);
	});
}

/** Runs a generator into a fresh temporary directory and marks its pages; the caller removes it. */
async function produce(config: ResolvedConfig, generator: ResolvedGenerator): Promise<string> {
	const outDir = await mkdtemp(join(tmpdir(), 'svelte-edda-generate-'));
	try {
		if (typeof generator.run === 'string') {
			// Double quotes work in both sh and cmd.exe.
			await shell(generator.run.replaceAll('{outDir}', `"${outDir}"`), config.root);
		} else {
			await generator.run({ outDir, root: config.root });
		}
		for (const file of await filesIn(outDir)) {
			if (!file.endsWith('.md')) continue;
			const path = join(outDir, file);
			await writeFile(path, mark(await readFile(path, 'utf8'), generator));
		}
		return outDir;
	} catch (error) {
		await rm(outDir, { recursive: true, force: true });
		throw error;
	}
}

/** Git on Windows may check files out with CRLF; that is not an edit. */
const sameText = (a: Buffer, b: Buffer) =>
	a.equals(b) ||
	a.toString('latin1').replaceAll('\r\n', '\n') === b.toString('latin1').replaceAll('\r\n', '\n');

/** Differences between the committed pages and what the generator writes now. */
async function compare(
	config: ResolvedConfig,
	generator: ResolvedGenerator,
	outDir: string
): Promise<Diagnostic[]> {
	const [fresh, committed] = await Promise.all([filesIn(outDir), filesIn(generator.dir)]);
	const fix = `${generator.description} Run \`svelte-edda generate\` and commit the result.`;
	const diagnostics: Diagnostic[] = [];
	for (const file of new Set([...fresh, ...committed])) {
		const path = fromRoot(config, join(generator.dir, file));
		let message: string | undefined;
		if (!committed.includes(file)) message = `missing: the generator writes this page. ${fix}`;
		else if (!fresh.includes(file))
			message = `not written by the generator, so it does not belong in this folder. ${fix}`;
		else {
			const [now, before] = await Promise.all([
				readFile(join(outDir, file)),
				readFile(join(generator.dir, file))
			]);
			if (!sameText(now, before))
				message = `differs from what the generator writes: edited by hand, or out of date. ${fix}`;
		}
		if (message) diagnostics.push({ file: path, message, severity: 'error' });
	}
	return diagnostics;
}

/**
 * Runs every generator. `write` replaces each generated folder with fresh output; `check` does the
 * same for uncommitted folders and compares committed ones instead of touching them. A failing
 * generator is a diagnostic, never a thrown error, so `dev` keeps serving the pages it had.
 */
export async function runGenerators(
	config: ResolvedConfig,
	mode: 'write' | 'check',
	only: ResolvedGenerator[] = config.generate
): Promise<Diagnostic[]> {
	const configFile = fromRoot(config, config.configFile ?? config.root) || '.';
	const diagnostics: Diagnostic[] = [];
	for (const generator of only) {
		let outDir: string;
		try {
			outDir = await produce(config, generator);
		} catch (error) {
			diagnostics.push({
				file: configFile,
				message: `the generator for ${fromRoot(config, generator.dir)}/ failed: ${error instanceof Error ? error.message : String(error)}`,
				severity: 'error'
			});
			continue;
		}
		try {
			if (mode === 'check' && generator.commit) {
				diagnostics.push(...(await compare(config, generator, outDir)));
			} else {
				const kept = await handWritten(config, generator);
				if (kept.length > 0) {
					diagnostics.push(
						...kept.map((file) => ({
							file,
							message: `was not written by a generator, so the generator for ${fromRoot(config, generator.dir)}/ leaves the folder alone rather than delete it. Move the page out of the folder, or delete it.`,
							severity: 'error' as const
						}))
					);
					continue;
				}
				await sync(outDir, generator.dir);
			}
		} finally {
			await rm(outDir, { recursive: true, force: true });
		}
	}
	return diagnostics;
}

/**
 * Wraps `run` so a burst of calls starts it once, `delay` ms after the last one, and a call while
 * it runs starts it again afterwards instead of a second run on top of the first.
 */
export function coalesce(run: () => Promise<void>, delay = 100): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;
	let again = false;
	const start = async () => {
		if (running) {
			again = true;
			return;
		}
		running = true;
		try {
			await run();
		} finally {
			running = false;
			if (again) {
				again = false;
				trigger();
			}
		}
	};
	const trigger = () => {
		clearTimeout(timer);
		timer = setTimeout(start, delay);
	};
	return trigger;
}
