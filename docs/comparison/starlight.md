---
sidebar: Starlight
title: A Starlight alternative without MDX
description: How svelte-edda differs from Astro Starlight in pages, components, versions and llms.txt, how to move a docs folder over, and when Starlight fits better.
---

# Starlight alternative

Starlight is a documentation theme for Astro, and the closest to svelte-edda in what it ships:
static HTML, islands only where needed, Pagefind for search, fallback for untranslated pages. They
differ in how a page uses components and in how much is built in.

|                           | svelte-edda                        | Starlight                                              |
| ------------------------- | ---------------------------------- | ------------------------------------------------------ |
| Components in a page      | HTML comments, in `.md`            | JSX in `.mdx`, or `{% %}` tags in `.mdoc`              |
| Your own components       | Svelte                             | Astro, and React, Preact, Svelte, Vue, Solid or Alpine |
| Notes and warnings        | GitHub alerts                      | `:::note` asides                                       |
| Search                    | Pagefind, built in                 | Pagefind, built in                                     |
| Untranslated pages        | Fall back, with a notice           | Fall back, with a notice                               |
| Interface languages       | English, Russian, German           | More than thirty                                       |
| Older versions            | Built from git tags                | Community plugin                                       |
| `llms.txt`, page as `.md` | Built in                           | Community plugins                                      |
| Broken links              | Error in `check` and `build`       | Community plugin                                       |
| Project                   | A `docs/` folder and a config file | An Astro project                                       |

As of November 2026, from the Starlight documentation on
[components](https://starlight.astro.build/components/using-components/),
[search](https://starlight.astro.build/guides/site-search/),
[internationalization](https://starlight.astro.build/guides/i18n/) and
[plugins](https://starlight.astro.build/resources/plugins/).

## Why switch

**The pages stay `.md`.** Tabs and cards do not turn a page into MDX, so GitHub, npm and agents
read the same text as the site.

**The docs stay in `docs/`.** There is no second project to configure, build and keep up to date.

**Less to assemble.** Versions, link checks, `llms.txt` and a Markdown copy of every page need no
plugins.

## Moving a docs folder

Copy `src/content/docs/` to `docs/`, rename `.mdx` to `.md`, then run `svelte-edda check` and fix
what it reports.

| Starlight                         | svelte-edda                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `:::note`, `:::tip`, `:::caution` | `> [!NOTE]`, `> [!TIP]`, `> [!CAUTION]`, see [alerts](../writing/formatting.md) |
| `<Tabs>` with `<TabItem>`         | `<!-- tabs -->`, see [tabs](../writing/tabs.md)                                 |
| `<CardGrid>`, `<Card>`, `<Steps>` | [Cards and steps](../writing/blocks.md)                                         |
| `import` and your own components  | [Svelte components](../custom-components.md) registered in the config           |
| `sidebar` in the Astro config     | [`sidebar`](../writing/index.md#the-sidebar) in the config                      |
| `template: splash` with `hero`    | `layout: landing` with a [hero](../writing/blocks.md#hero)                      |
| `locales` with a `root` language  | [`locales`](../languages.md), with a folder for the default language too        |

## When Starlight fits better

- The site is already built with Astro, or should hold more than documentation.
- You want components from several UI frameworks.
- The interface has to be in a language svelte-edda does not ship and you do not want to
  [translate it](../languages.md).
- You want the plugins of a larger community.
