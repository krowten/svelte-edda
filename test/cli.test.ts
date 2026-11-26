import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { version } from '../package.json';

const cli = (...args: string[]) => {
	const root = mkdtempSync(join(tmpdir(), 'svelte-edda-cli-'));
	const config = join(import.meta.dir, 'fixtures', 'basic');
	try {
		return spawnSync(
			process.execPath,
			[join(import.meta.dir, '..', 'src', 'cli.ts'), ...args, '--root', config],
			{ encoding: 'utf8', cwd: root, timeout: 20_000 }
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

describe('cli', () => {
	test('prints its version', () => {
		expect(cli('--version').stdout).toBe(`${version}\n`);
		expect(cli('-v').stdout).toBe(`${version}\n`);
	});

	test('accepts --host without an address, also before another option', () => {
		// An unknown command ends the run right after the options are read.
		expect(cli('nope', '--host').stderr).toStartWith('Unknown command: nope');
		expect(cli('nope', '--host', '--port', '80').stderr).toStartWith('Unknown command: nope');
	});

	test('refuses a port that is not one', () => {
		expect(cli('preview', '--port', 'abc').stderr).toContain('--port must be a number');
	});
});
