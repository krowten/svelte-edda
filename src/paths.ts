import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

function findPackageRoot(from: string): string {
	let dir = from;
	while (!existsSync(join(dir, 'package.json'))) {
		const parent = dirname(dir);
		if (parent === dir) throw new Error('svelte-edda: cannot find its own package root');
		dir = parent;
	}
	return dir;
}

// Works from both `src/*.ts` and the bundled `dist/*.js`.
export const engineRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)));
export const engineSrc = join(engineRoot, 'src');

export function toPosix(path: string): string {
	return path.replaceAll('\\', '/');
}

/** Whether `path` is `dir` or lies under it. On Windows a path on another drive stays absolute. */
export function isInside(dir: string, path: string): boolean {
	const rest = relative(dir, path);
	return rest !== '..' && !/^\.\.[\\/]/.test(rest) && !isAbsolute(rest);
}

/** A link's path with `%20` and the like decoded; as written when it is not a valid encoding. */
export function decodePath(path: string): string {
	try {
		return decodeURI(path);
	} catch {
		return path;
	}
}
