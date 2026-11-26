---
sidebar: Docusaurus
title: A Docusaurus alternative for plain Markdown docs
description: How svelte-edda differs from Docusaurus in Markdown, search, versions and llms.txt, how to move a docs folder over, and when to stay with Docusaurus.
---

# Docusaurus alternative

Docusaurus compiles every page to a React component. svelte-edda turns plain Markdown into HTML and
hydrates only the components you mark interactive. Both give you a static site from a `docs/`
folder, with a sidebar, translations and versions.

|                           | svelte-edda                          | Docusaurus                                                           |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `.md` files are           | GitHub Flavored Markdown             | MDX by default; CommonMark is an experimental option                 |
| Components in a page      | HTML comments around Markdown        | JSX                                                                  |
| Search                    | Pagefind, built in                   | Algolia DocSearch; local search from community plugins               |
| A new version of the docs | A git tag in the config              | A copy of `docs/` in `versioned_docs/`                               |
| Untranslated pages        | Fall back, with a notice             | Fall back to the default language                                    |
| `llms.txt`, page as `.md` | Built in                             | Community plugins                                                    |
| Broken links              | Error in `check` and `build`         | Error in the build                                                   |
| Project dependencies      | One package, no framework of its own | A React project                                                      |
| Beyond docs               | Docs and landing pages               | Blog, custom React pages, a large set of plugins and theme overrides |

As of November 2026, Docusaurus 3.10, from its
[Markdown](https://docusaurus.io/docs/markdown-features), [search](https://docusaurus.io/docs/search)
and [versioning](https://docusaurus.io/docs/versioning) documentation.

## Why switch

**Markdown that other tools read.** In MDX a `{` or a `<` in the text is syntax, and a page with
imports and JSX shows them as text on GitHub and npm. A svelte-edda page is the same text
everywhere.

**Search without a service.** The index is built with the site and served with it: no application,
no crawler, nothing to wait for after a deploy.

**Versions without copies.** An older version is the docs directory at its tag. A fix to the
current docs is one edit, and a search in your editor finds one match.

## Moving a docs folder

Most pages need no change. Run `svelte-edda check` after copying the folder: it reports what is
left, with file and line.

| Docusaurus                            | svelte-edda                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `:::note`, `:::tip`, `:::warning`     | `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, see [alerts](../writing/formatting.md) |
| `<Tabs>` with `<TabItem label="npm">` | `<!-- tabs -->` with `**npm**`, see [tabs](../writing/tabs.md)                  |
| `import` and your own JSX components  | [Svelte components](../custom-components.md) registered in the config           |
| `sidebars.js`, `sidebar_position`     | [`sidebar`](../writing/index.md#the-sidebar) in the config                      |
| `sidebar_label`                       | `sidebar` in the frontmatter                                                    |
| `themeConfig.navbar`                  | `nav` in the config                                                             |
| `versioned_docs/`                     | [`versions`](../versions.md), from git tags                                     |
| `i18n/<locale>/`                      | [A folder per language](../languages.md) in `docs/`                             |

The theme, blog and custom React pages do not carry over.

## When to stay with Docusaurus

- The site is more than documentation: a blog, React pages, plugins you rely on.
- Several versions are edited side by side, not archived.
- Your components are React, and the team wants to keep them.
- You need the larger community and a longer track record.
