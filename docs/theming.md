---
description: Restyle the site with Tailwind theme tokens, fonts and a logo.
---

# Theming

The theme is built with [Tailwind CSS](https://tailwindcss.com) 4. You restyle it with your own CSS
file, the same way you would configure Tailwind in an app.

## Colors and fonts

Point the `css` option at a stylesheet:

```ts
export default defineConfig({
	title: 'My library',
	css: 'docs-theme.css'
});
```

In it, override theme tokens:

```css
@theme {
	--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
	--font-mono: 'JetBrains Mono', ui-monospace, monospace;

	--color-accent-50: oklch(0.97 0.02 30);
	--color-accent-100: oklch(0.94 0.04 30);
	--color-accent-200: oklch(0.89 0.07 30);
	--color-accent-300: oklch(0.81 0.12 30);
	--color-accent-400: oklch(0.72 0.17 30);
	--color-accent-500: oklch(0.65 0.2 30);
	--color-accent-600: oklch(0.58 0.21 30);
	--color-accent-700: oklch(0.5 0.19 30);
	--color-accent-800: oklch(0.43 0.16 30);
	--color-accent-900: oklch(0.37 0.13 30);
	--color-accent-950: oklch(0.26 0.09 30);
}
```

Without them the fonts are Tailwind's defaults. The theme is made of Tailwind utilities, which live
in a CSS layer, so a plain rule in your file wins over it.

The default theme follows the look of the Svelte documentation using only Tailwind's own palette
and scale: two scales of the theme's own, `base` for grays and `accent` for color, point at `zinc`
and `orange`.

The `accent` scale colors links, the active page, tabs and buttons. Light mode mostly uses
`accent-700`, dark mode `accent-500`.

The `base` scale gives every gray: backgrounds, borders, text. Light mode uses the light end
(`white`, `base-50` to `base-300` for surfaces and borders, `base-500` to `base-900` for text),
dark mode the dark end (`base-700` to `base-900` for surfaces and borders, `base-200` to
`base-500` for text).

To switch either scale to another Tailwind palette, point all eleven steps at it:

```css
@theme {
	--color-base-50: var(--color-stone-50);
	--color-base-100: var(--color-stone-100);
	--color-base-200: var(--color-stone-200);
	--color-base-300: var(--color-stone-300);
	--color-base-400: var(--color-stone-400);
	--color-base-500: var(--color-stone-500);
	--color-base-600: var(--color-stone-600);
	--color-base-700: var(--color-stone-700);
	--color-base-800: var(--color-stone-800);
	--color-base-900: var(--color-stone-900);
	--color-base-950: var(--color-stone-950);
}
```

Your own colors work the same way, as in the `accent` example above; keep body text (`base-700`
in light mode, `base-300` in dark mode) at WCAG AA contrast against the page. Your components can
use the scales too, with `dark:` for dark mode: `bg-base-50 dark:bg-base-800`, `text-accent-700`.

Your file is imported after the default theme, so it can also add plain CSS rules.

## Loading fonts

Fonts served from your own files go in the same CSS file with `@font-face`. For a hosted font,
add its stylesheet to every page with `head`:

```ts
export default defineConfig({
	title: 'My library',
	css: 'docs-theme.css',
	head: [
		'<link rel="preconnect" href="https://fonts.googleapis.com" />',
		'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" />'
	]
});
```

## Logo

```ts
export default defineConfig({
	title: 'My library',
	logo: { src: 'assets/logo.svg', dark: 'assets/logo-dark.svg', alt: 'My library' }
});
```

`dark` is optional and used in dark mode. Paths are relative to the config file.

## Dark mode

The site follows the system setting until the reader picks a mode with the toggle in the header;
the choice is remembered. Use Tailwind's `dark:` variant in your components and CSS.
