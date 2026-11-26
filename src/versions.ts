import type { ResolvedConfig, ResolvedVersion } from './config.ts';
import type { Variant } from './pages.ts';
import type { SiteSet } from './render.ts';

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';

import { scanSite } from './pages.ts';
import { toPosix } from './paths.ts';

const run = promisify(execFile);

async function git(args: string[], cwd: string): Promise<Buffer> {
	try {
		const { stdout } = await run('git', args, {
			cwd,
			encoding: 'buffer',
			maxBuffer: 256 * 1024 * 1024
		});
		return stdout;
	} catch (error) {
		const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
		throw new Error(`svelte-edda: git ${args[0]} failed${stderr ? `: ${stderr}` : ''}`, {
			cause: error
		});
	}
}

/** Date of the last commit that touched the file, `YYYY-MM-DD`, or undefined outside git. */
export async function lastModified(file: string, cwd: string): Promise<string | undefined> {
	try {
		const { stdout } = await run('git', ['log', '-1', '--format=%cs', '--', file], { cwd });
		return stdout.trim() || undefined;
	} catch {
		return undefined;
	}
}

/** The top of the git working tree holding `dir`, or `dir` itself outside git. */
export async function repositoryRootOf(dir: string): Promise<string> {
	try {
		const { stdout } = await run('git', ['rev-parse', '--show-toplevel'], { cwd: dir });
		return stdout.trim() || dir;
	} catch {
		return dir;
	}
}

export function versionBase(config: ResolvedConfig, version: ResolvedVersion): string {
	return `${config.base}v/${version.slug}/`;
}

/** The commit a version's tag points to, or an error naming the tag. */
export async function versionCommit(
	config: ResolvedConfig,
	version: ResolvedVersion
): Promise<string> {
	try {
		return (await git(['rev-parse', '--verify', `${version.tag}^{commit}`], config.root))
			.toString()
			.trim();
	} catch {
		throw new Error(`svelte-edda: git tag "${version.tag}" (version ${version.label}) not found`);
	}
}

/**
 * Extracts the docs directory as it was at the version's tag into the cache, once per commit,
 * and returns it as a variant served under `/v/<slug>/`.
 */
export async function archivedVariant(
	config: ResolvedConfig,
	version: ResolvedVersion
): Promise<Variant> {
	const commit = await versionCommit(config, version);
	const top = (await git(['rev-parse', '--show-toplevel'], config.root)).toString().trim();
	const docsPath = toPosix(relative(top, config.docsDir));
	const target = join(config.cacheDir, 'versions', `${version.slug}-${commit.slice(0, 12)}`);
	const variant = { docsDir: target, base: versionBase(config, version), version };
	const marker = join(target, '.complete');
	if (existsSync(marker)) return variant;

	const files = (
		await git(
			['ls-tree', '-r', '-z', '--name-only', commit, '--', docsPath ? `${docsPath}/` : '.'],
			top
		)
	)
		.toString()
		.split('\0')
		.filter(Boolean);
	if (files.length === 0) {
		throw new Error(`svelte-edda: tag "${version.tag}" has no ${docsPath || '.'}/ directory`);
	}

	await rm(target, { recursive: true, force: true });
	for (const path of files) {
		const file = join(target, relative(docsPath, path));
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, await git(['show', `${commit}:${path}`], top));
	}
	await writeFile(marker, `${version.tag}\n`);
	return variant;
}

/** The working tree and every archived version, scanned. */
export async function scanSites(config: ResolvedConfig): Promise<SiteSet> {
	const current = await scanSite(config);
	const archived = await Promise.all(
		config.versions.map(async (version) => scanSite(config, await archivedVariant(config, version)))
	);
	return { current, archived };
}
