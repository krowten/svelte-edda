---
sidebar: VitePress
title: A VitePress alternative with Svelte and plain Markdown
description: How svelte-edda differs from VitePress in components, versions, translations and llms.txt, how to move a docs folder over, and when VitePress fits better.
---

# VitePress alternative

VitePress and svelte-edda are close: both are small, build on Vite, take a folder of Markdown and
need little configuration. VitePress compiles each page to a Vue component; svelte-edda keeps the
page Markdown and puts Svelte behind HTML comments.

|                           | svelte-edda                                | VitePress                                        |
| ------------------------- | ------------------------------------------ | ------------------------------------------------ |
| A page is                 | GitHub Flavored Markdown                   | Markdown processed as a Vue component            |
| `{{ }}` in the text       | Text                                       | Vue interpolation, escaped with `v-pre`          |
| Components in a page      | HTML comments around Markdown              | Vue tags, imported in `<script setup>`           |
| Live demos                | A ` ```svelte live ` block                 | Your own Vue components                          |
| JavaScript of a page      | Menus and search, plus interactive islands | Vue and the page's dynamic parts                 |
| Search                    | Pagefind, on by default                    | MiniSearch or Algolia, switched on in the config |
| Untranslated pages        | Fall back, with a notice                   | Not described in its documentation               |
| Older versions            | Built from git tags                        | Not built in                                     |
| `llms.txt`, page as `.md` | Built in                                   | Community plugin                                 |
| Broken links              | Error in `check` and `build`               | Error in the build                               |
| GitHub alerts             | Yes                                        | Yes                                              |

As of November 2026, from the VitePress documentation on
[Vue in Markdown](https://vitepress.dev/guide/using-vue),
[search](https://vitepress.dev/reference/default-theme-search) and
[internationalization](https://vitepress.dev/guide/i18n).

## Why switch

**A Svelte library documents itself in Svelte.** Demos are code blocks that run, and
[`svelteComponents`](../generated-pages.md#svelte-components) writes a page of props for each
component.

**No template syntax in prose.** Text with `{{ }}` or an angle bracket needs no escaping.

**Versions and fallback are part of the tool**, see [versions](../versions.md) and
[languages](../languages.md).

## Moving a docs folder

Copy the folder, then run `svelte-edda check` and fix what it reports.

| VitePress                     | svelte-edda                                                              |
| ----------------------------- | ------------------------------------------------------------------------ |
| `::: tip`, `::: warning`      | `> [!TIP]`, `> [!WARNING]`, see [alerts](../writing/formatting.md)       |
| `::: code-group`              | `<!-- tabs -->`, see [tabs](../writing/tabs.md)                          |
| `<script setup>` and Vue tags | [Svelte components](../custom-components.md) registered in the config    |
| `themeConfig.sidebar`         | [`sidebar`](../writing/index.md#the-sidebar) in the config               |
| `themeConfig.nav`             | `nav` in the config                                                      |
| `layout: home` with `hero`    | `layout: landing` with a [hero](../writing/blocks.md#hero)               |
| `locales`                     | [`locales`](../languages.md), with a folder for the default language too |

## When VitePress fits better

- You document a Vue project and want Vue components in the pages.
- You want to extend the theme with Vue.
- You need the larger community and a longer track record.
