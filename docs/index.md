---
sidebar: Overview
title: 'svelte-edda: documentation site generator for Markdown'
description: A static documentation site generator that turns plain Markdown into a docs website with live Svelte demos, search, translations, versions and llms.txt for AI agents.
---

# svelte-edda

svelte-edda is a static documentation site generator. It turns a folder of Markdown files into a
documentation website. The Markdown stays plain: it reads well on GitHub, in your npm package and
for AI agents, while the site gets tabs, live Svelte demos, search and a theme you can restyle with
Tailwind.

- **Markdown is the source.** No MDX, no imports in your pages. Components are written as HTML
  comments, which GitHub hides, around ordinary Markdown.
- **Svelte components.** Register your own components in the config; mark them interactive and
  they hydrate in the browser as islands. Everything else ships as plain HTML.
- **Live demos.** A ` ```svelte live ` code block renders as a working component above its
  source.
- **For agents.** Every page is also served as Markdown, plus `llms.txt` and `llms-full.txt`.
- **Static output.** Build once, host anywhere; GitHub Pages works out of the box.

Coming from [Docusaurus](./comparison/docusaurus.md), [VitePress](./comparison/vitepress.md),
[Starlight](./comparison/starlight.md), [MkDocs](./comparison/mkdocs.md) or a
[hosted platform](./comparison/gitbook-mintlify.md)? See [how they compare](./comparison/index.md).

## Quick start

<!-- tabs -->

**bun**

```sh
bun add -d svelte-edda
bunx svelte-edda dev
```

**npm**

```sh
npm install -D svelte-edda
npx svelte-edda dev
```

**pnpm**

```sh
pnpm add -D svelte-edda
pnpm svelte-edda dev
```

<!-- /tabs -->

Put your pages in `docs/`, then continue with [Getting started](./getting-started.md).
