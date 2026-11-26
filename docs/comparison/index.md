---
sidebar: Overview
title: svelte-edda compared with other documentation generators
description: How svelte-edda differs from VitePress, Starlight, Docusaurus, MkDocs, GitBook and Mintlify, and when one of them is the better choice for your documentation.
---

# Comparison

svelte-edda is a static documentation site generator, like VitePress, Starlight and Docusaurus.
It differs from them in what the pages are written in, how much the site ships to the browser and
how much it does for AI agents without plugins. One page each goes further:
[Docusaurus](./docusaurus.md), [VitePress](./vitepress.md), [Starlight](./starlight.md),
[MkDocs](./mkdocs.md), [GitBook and Mintlify](./gitbook-mintlify.md).

|                                                      | svelte-edda                                                    | VitePress             | Starlight                 | Docusaurus                              |
| ---------------------------------------------------- | -------------------------------------------------------------- | --------------------- | ------------------------- | --------------------------------------- |
| Built on                                             | Svelte 5 and Vite                                              | Vue 3 and Vite        | Astro                     | React                                   |
| Pages                                                | Plain `.md`; components are HTML comments                      | `.md` with Vue inside | `.md`, `.mdx`, `.mdoc`    | MDX, also for `.md`                     |
| Your own components                                  | Svelte, hydrated only when interactive                         | Vue                   | Astro or any UI framework | React                                   |
| Search                                               | Pagefind, built in                                             | MiniSearch, built in  | Pagefind, built in        | Algolia DocSearch or a community plugin |
| Translations                                         | Built in, untranslated pages fall back to the default language | Built in              | Built in, with fallback   | Built in, with fallback                 |
| Older versions                                       | Built from git tags                                            | Separate deployments  | Plugin                    | Built in, copies of the docs            |
| `llms.txt` and `.md` per page                        | Built in                                                       | Plugin                | Plugins                   | Community plugins                       |
| Broken links                                         | Error in `check` and `build`                                   | Error in the build    | Community plugin          | Error in the build                      |
| Writing guide for agents, generated from your config | `svelte-edda guide`                                            | No                    | No                        | No                                      |

The comparison is as of November 2026, from each project's documentation.

## Markdown that stays Markdown

In VitePress, Starlight with MDX and Docusaurus, a page that uses a component holds framework
syntax: a Vue tag, a JSX import, an MDX expression. GitHub and npm show it as raw code, and an
agent that edits the page has to know the framework. In svelte-edda a component is a pair of HTML
comments around ordinary Markdown:

````md
<!-- tabs -->

**npm**

```sh
npm install my-library
```

**bun**

```sh
bun add my-library
```

<!-- /tabs -->
````

GitHub hides the comments and shows the content, so the same file is a readable page in the
repository, in the npm package and on the site. See [custom components](../custom-components.md).

## Documentation for AI agents

Every page is also published as Markdown, with `llms.txt` and `llms-full.txt` beside the site,
without plugins. Agents that write the docs get `svelte-edda guide`, the syntax and components of
your project, and `svelte-edda check`, which reports a wrong marker or a broken link with file and
line. See [AI agents](../ai-agents.md).

## When another tool fits better

- **Docusaurus** has the largest ecosystem of plugins and the most mature versioning, for a large
  product with many versions maintained at once.
- **VitePress** suits a Vue project that wants Vue components in its pages.
- **Starlight** suits a team already on Astro, or one that wants components from several UI
  frameworks.
- **svelte-edda** suits a library, especially a Svelte one, whose docs live in the repository as
  plain Markdown and are read and written by agents as much as by people.
