import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const basic = 'http://localhost:4420/fixture/';
const polyglot = 'http://localhost:4421/poly/';
const dev = 'http://localhost:4422/fixture/';

test.describe('tabs', () => {
	test('switch by click and keyboard and remember the choice', async ({ page }) => {
		await page.goto(`${basic}guide/install/`);
		const tabs = page.getByTestId('tabs');
		const npm = tabs.getByRole('tab', { name: 'npm' });
		const bun = tabs.getByRole('tab', { name: 'bun' });
		await expect(npm).toHaveAttribute('aria-selected', 'true');

		await bun.click();
		await expect(bun).toHaveAttribute('aria-selected', 'true');
		await expect(tabs.getByRole('tabpanel')).toContainText('bun add fixture');

		await bun.press('ArrowLeft');
		await expect(npm).toBeFocused();
		await expect(npm).toHaveAttribute('aria-selected', 'true');
		await npm.press('End');
		await expect(bun).toBeFocused();

		await page.reload();
		await expect(tabs.getByRole('tab', { name: 'bun' })).toHaveAttribute('aria-selected', 'true');
	});

	test('log no Svelte warnings on the dev server', async ({ page }) => {
		const warnings: string[] = [];
		page.on('console', (message) => {
			if (message.text().includes('[svelte]')) warnings.push(message.text());
		});
		await page.goto(`${dev}guide/install/`);
		const npm = page.getByTestId('tabs').getByRole('tab', { name: 'npm' });
		// On a cold dev server the island may hydrate after the first key press.
		await expect(async () => {
			await npm.press('End');
			await expect(page.getByTestId('tabs').getByRole('tab', { name: 'bun' })).toBeFocused({
				timeout: 500
			});
		}).toPass();
		expect(warnings).toEqual([]);
	});

	test('show every variant without JavaScript', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(`${basic}guide/install/`);
		const tabs = page.getByTestId('tabs');
		await expect(tabs.getByRole('tablist')).toBeHidden();
		await expect(tabs.getByText('npm install fixture')).toBeVisible();
		await expect(tabs.getByText('bun add fixture')).toBeVisible();
		await context.close();
	});
});

test('islands and live demos hydrate', async ({ page }) => {
	await page.goto(basic);
	const counter = page.getByTestId('counter');
	await counter.click();
	await expect(counter).toHaveText('Clicked 1');

	await page.goto(`${basic}guide/install/`);
	const demo = page.getByTestId('live-demo-preview').getByRole('button');
	await demo.click();
	await demo.click();
	await expect(demo).toHaveText('4');
});

test('a server-rendered component gets its scoped styles and its content as layout items', async ({
	page
}) => {
	await page.goto(basic);
	const badge = page.getByTestId('badge');
	await expect(badge).not.toHaveCSS('letter-spacing', 'normal');
	// The wrapper around the Markdown content takes no box of its own.
	const wrapperDisplay = await badge.evaluate(
		(element) => getComputedStyle(element.firstElementChild!).display
	);
	expect(wrapperDisplay).toBe('contents');
});

test('a hero sets its code beside the text and a linked card is one target', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`${basic}blocks/`);
	const hero = page.getByTestId('hero');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blocks for everyone');
	const title = (await hero.getByRole('heading').boundingBox())!;
	const code = (await hero.getByRole('button', { name: 'Copy code' }).boundingBox())!;
	expect(code.x).toBeGreaterThan(title.x + title.width);

	const card = page.getByTestId('cards').getByRole('listitem').filter({ hasText: 'One command.' });
	const box = (await card.boundingBox())!;
	await card.click({ position: { x: box.width - 10, y: box.height - 10 } });
	await expect(page).toHaveURL(/\/fixture\/guide\/install\/$/);
});

test('copy button copies the code', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto(`${basic}guide/install/`);
	const block = page.getByTestId('tabs').getByRole('tabpanel');
	await block.hover();
	await block.getByRole('button', { name: 'Copy code' }).click();
	await expect(block.getByRole('button', { name: 'Copy code' })).toHaveText('Copied');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
		'npm install fixture'
	);
});

test('theme toggle persists', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto(basic);
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'light');
	await page.getByTestId('theme-toggle').click();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(html).toHaveAttribute('data-theme', 'dark');
});

test('the base scale restyles the grays in both modes', async ({ page }) => {
	const colors = async () => ({
		page: await page.locator('html').evaluate((el) => getComputedStyle(el).backgroundColor),
		text: await page
			.getByTestId('page-content')
			.getByRole('paragraph')
			.first()
			.evaluate((el) => getComputedStyle(el).color)
	});
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto(basic);
	expect((await colors()).text).toBe('oklch(0.35 0.02 250)');
	await page.getByTestId('theme-toggle').click();
	expect(await colors()).toEqual({ page: 'oklch(0.2 0.02 250)', text: 'oklch(0.85 0.01 250)' });
});

test('search finds pages', async ({ page }) => {
	await page.goto(basic);
	await page.keyboard.press('Control+k');
	const dialog = page.getByTestId('search-dialog');
	await expect(dialog).toBeVisible();
	await page.getByTestId('search-input').fill('numeric prefix');
	const result = page.getByTestId('search-result').first();
	await expect(result).toHaveAttribute('href', '/fixture/guide/concepts/');
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.keyboard.press('Control+k');
	await page.getByTestId('search-input').fill('zzzzqqq');
	await expect(page.getByTestId('search-status')).toHaveText('No results for “zzzzqqq”');
});

test('clearing the search field drops results still on their way', async ({ page }) => {
	await page.goto(basic);
	await page.keyboard.press('Control+k');
	const input = page.getByTestId('search-input');
	await input.fill('numeric prefix');
	await expect(page.getByTestId('search-result').first()).toBeVisible();
	await input.fill('install');
	await input.fill('');
	// Longer than Pagefind's debounce of 300 ms.
	await page.waitForTimeout(1000);
	await expect(page.getByTestId('search-result')).toHaveCount(0);
});

test('mobile navigation opens and closes', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });
	await page.goto(basic);
	const sidebar = page.getByTestId('sidebar');
	await expect(sidebar).toBeHidden();
	const toggle = page.getByRole('button', { name: 'Open navigation' });
	await toggle.click();
	await expect(sidebar).toBeVisible();
	await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await page.keyboard.press('Escape');
	await expect(sidebar).toBeHidden();
});

test('a landing page keeps the sidebar behind the menu button', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`${basic}landing/`);
	const sidebar = page.getByTestId('sidebar');
	await expect(sidebar).toBeHidden();
	await expect(page.getByTestId('toc')).toHaveCount(0);
	await page.getByRole('button', { name: 'Open navigation' }).click();
	await expect(sidebar.getByRole('link', { name: 'Start here' })).toBeVisible();

	// Crossing the width where the menu button comes and goes closes the menu.
	await page.setViewportSize({ width: 375, height: 800 });
	await expect(sidebar).toBeHidden();

	// The docs layout shows it beside the page instead.
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`${basic}guide/install/`);
	await expect(page.getByTestId('sidebar')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();
});

test('header links sit in the header on wide screens and in the menu on phones', async ({
	page
}) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`${polyglot}guide/`);
	const header = page.getByTestId('header-nav');
	await expect(header.getByRole('link', { name: 'Guide' })).toHaveAttribute('aria-current', 'page');

	await page.setViewportSize({ width: 375, height: 800 });
	await expect(header).toBeHidden();
	await page.getByRole('button', { name: 'Open navigation' }).click();
	await expect(page.getByTestId('drawer-nav').getByRole('link', { name: 'GitHub' })).toBeVisible();
});

test('sidebar groups close, stay closed for the session and open on their own pages', async ({
	page
}) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(basic);
	const sidebar = page.getByTestId('sidebar');
	const concepts = sidebar.getByRole('link', { name: 'Core concepts' });
	const toggle = sidebar.getByRole('button', { name: 'Show or hide Guide' });
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await toggle.click();
	await expect(concepts).toBeHidden();
	await page.goto(`${basic}landing/`);
	await page.goto(basic);
	await expect(concepts).toBeHidden();
	await page.goto(`${basic}guide/install/`);
	await expect(concepts).toBeVisible();
	// The group's own page is beside its list, not in it.
	await page.goto(`${basic}guide/`);
	await expect(concepts).toBeVisible();
});

test('without JavaScript every sidebar group is open', async ({ browser }) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 1400, height: 900 }
	});
	const page = await context.newPage();
	// `Learn` is configured as collapsed.
	await page.goto(polyglot);
	await expect(page.getByTestId('sidebar').getByRole('link', { name: 'Guide' })).toBeVisible();
	await context.close();
});

test('a long sidebar scrolls to the current page', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 200 });
	await page.goto(`${basic}guide/install/`);
	await expect(page.getByTestId('sidebar').getByRole('link', { name: 'Install' })).toBeInViewport();
});

test('the table of contents marks the section being read', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 500 });
	await page.goto(`${basic}guide/install/`);
	const toc = page.getByTestId('toc');
	await expect(toc.getByRole('link', { name: 'Usage' })).toHaveAttribute('aria-current', 'true');
	await page.keyboard.press('End');
	await expect(toc.getByRole('link', { name: 'Live' })).toHaveAttribute('aria-current', 'true');
	await expect(toc.getByRole('link', { name: 'Usage' })).not.toHaveAttribute('aria-current');
});

test('unknown pages show the 404 page', async ({ page }) => {
	const response = await page.goto(`${basic}nope/`);
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

test.describe('languages', () => {
	test('the language menu leads to the same page in another language', async ({ page }) => {
		await page.goto(`${polyglot}guide/`);
		const menu = page.getByTestId('language-menu');
		await page.getByTestId('language-menu-toggle').click();
		await menu.getByRole('link', { name: 'Русский' }).click();
		await expect(page).toHaveURL(`${polyglot}ru/guide/`);
		await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
		await expect(page.getByTestId('untranslated-banner')).toBeVisible();
		await expect(page.getByTestId('toc')).toContainText('На этой странице');
	});

	test('search runs in the page language', async ({ page }) => {
		await page.goto(`${polyglot}ru/`);
		await page.getByTestId('search-open').click();
		await page.getByTestId('search-input').fill('примечание');
		await expect(page.getByTestId('search-result').first()).toHaveAttribute('href', '/poly/ru/');
	});
});

test.describe('accessibility', () => {
	for (const [name, url] of [
		['home', basic],
		['tabs and demo', `${basic}guide/install/`],
		['landing page', `${basic}landing/`],
		['hero, cards and steps', `${basic}blocks/`],
		['translated page', `${polyglot}ru/`],
		['untranslated page', `${polyglot}ru/guide/`]
	]) {
		for (const colorScheme of ['light', 'dark'] as const) {
			test(`${name} has no serious axe violations in ${colorScheme} mode`, async ({ page }) => {
				await page.emulateMedia({ colorScheme });
				await page.goto(url!);
				const results = await new AxeBuilder({ page }).analyze();
				const serious = results.violations
					.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
					.map(
						(violation) =>
							`${violation.id}: ${violation.nodes.map((node) => node.html.slice(0, 80)).join(' | ')}`
					);
				expect(serious).toEqual([]);
			});
		}
	}
});
