import { defineConfig, devices } from '@playwright/test';

const site = (fixture: string, base: string, port: number) => ({
	command: `bun src/cli.ts build --root test/fixtures/${fixture} && bun src/cli.ts preview --root test/fixtures/${fixture} --port ${port}`,
	// A file, not a directory: the readiness probe sends no `Accept: text/html`, so a directory
	// URL would not be resolved to its index.html and would answer 404.
	url: `http://localhost:${port}${base}index.html`,
	reuseExistingServer: !process.env.CI,
	timeout: 120_000
});

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { trace: 'retain-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	// The built sites, served the way users get them: static files under a base path.
	webServer: [
		site('basic', '/fixture/', 4420),
		site('i18n', '/poly/', 4421),
		// The dev server too: Svelte's runtime warnings exist only in development builds.
		{
			command: 'bun src/cli.ts dev --root test/fixtures/basic --port 4422',
			url: 'http://localhost:4422/fixture/',
			reuseExistingServer: !process.env.CI,
			timeout: 120_000
		}
	]
});
