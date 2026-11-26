---
sidebar: MkDocs
title: A MkDocs alternative for JavaScript and TypeScript projects
description: Where MkDocs and Material for MkDocs stand in 2026, what Zensical changes, how svelte-edda differs, and how to move a docs folder over.
---

# MkDocs alternative

## Where MkDocs stands

As of November 2026:

- **MkDocs 1.x** had its [last release, 1.6.1](https://www.mkdocs.org/about/release-notes/), in
  August 2024.
- **MkDocs 2.0** is a rewrite in pre-release. According to the
  [Material for MkDocs team](https://squidfunk.github.io/mkdocs-material/blog/2026/02/18/mkdocs-2.0/)
  it has no plugin system, and its changes are not compatible with Material.
- **Material for MkDocs** is
  [in maintenance mode](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/):
  critical fixes only, through May 5, 2027.
- **[Zensical](https://zensical.org)**, by the same team, is the successor. It reads `mkdocs.yml`
  and is the shortest way forward for an existing site, above all for a Python project.

svelte-edda is worth a look when you would rather move to tools of the JavaScript world, and to
Markdown without extensions.

## The differences

|                           | svelte-edda                                         | MkDocs with Material                                                                                   |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Runs on                   | Node.js or Bun                                      | Python                                                                                                 |
| Markdown                  | GitHub Flavored Markdown                            | Python-Markdown with extensions                                                                        |
| Notes and warnings        | `> [!NOTE]`, as on GitHub                           | `!!! note` with an indented block                                                                      |
| Tabs                      | HTML comments around Markdown                       | `=== "Tab"` with an indented block                                                                     |
| Components and live demos | Svelte                                              | HTML and templates                                                                                     |
| Search                    | Pagefind, built in                                  | lunr.js, built in                                                                                      |
| Older versions            | Built from git tags, one build                      | [mike](https://squidfunk.github.io/mkdocs-material/setup/setting-up-versioning/), deployed to a branch |
| `llms.txt`, page as `.md` | Built in                                            | Not built in                                                                                           |
| API reference             | Svelte components, or any tool that writes Markdown | mkdocstrings, for Python and more                                                                      |

## Moving a docs folder

Pages without extensions work as they are. The rest is mechanical, and an agent can do it with
`svelte-edda guide` and `svelte-edda check`.

| MkDocs                      | svelte-edda                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| `!!! note`, `!!! warning`   | `> [!NOTE]`, `> [!WARNING]`, see [alerts](../writing/formatting.md) |
| `=== "npm"`                 | `<!-- tabs -->` with `**npm**`, see [tabs](../writing/tabs.md)      |
| `nav` in `mkdocs.yml`       | [`sidebar`](../writing/index.md#the-sidebar) in the config          |
| `extra_css`, palette        | [`css`](../theming.md) with Tailwind tokens                         |
| `mike`                      | [`versions`](../versions.md)                                        |
| `gen-files`, `mkdocstrings` | [Generated pages](../generated-pages.md), also with pydoc-markdown  |

> [!WARNING]
> `check` does not report `!!! note`, `??? note` and `=== "Tab"`: in Markdown they are ordinary text,
> and their indented bodies are code blocks. Search the folder for them.

## When to stay

- The project is Python and uses mkdocstrings: Zensical keeps `mkdocs.yml` and the Markdown.
- The site relies on MkDocs plugins or template overrides.
- Nobody on the team wants Node.js in the build.
