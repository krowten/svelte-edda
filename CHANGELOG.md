# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org) once the package leaves 0.x.

## 0.1.0 - 2026-11-26

First public release.

- `svelte-edda dev`, `build`, `preview`, `check`, `generate` and `guide`: a `docs/` folder of plain
  Markdown becomes a static site, without Svelte or Vite in your project.
- Components as HTML comments around Markdown; built-in tabs, cards, steps and hero; your own
  Svelte components, interactive ones hydrated as islands; ` ```svelte live ` demos.
- GitHub alerts, Shiki highlighting with copy buttons, link checks with file and line.
- Tailwind theme restyled with `@theme` tokens (`--color-accent-*`, `--color-base-*`, fonts) and a
  CSS file of your own.
- Languages as folders with fallback to the default one, interface strings in English, Russian and
  German; archived versions built from git tags.
- Generated pages: props tables of Svelte 5 components with `svelteComponents()`, or any command
  such as TypeDoc; `check` reports committed pages that went stale.
- Pagefind search, sitemap, `robots.txt`, social cards, canonical URLs, `hreflang`, structured
  data; every page also served as `.md`, plus `llms.txt` and `llms-full.txt`.
