---
description: Install svelte-edda with Bun, npm or pnpm, write the first Markdown page and build a static documentation site.
---

# Getting started

## Install

svelte-edda runs on Bun or Node.js 22.18 and newer. It brings its own Svelte, Vite and Tailwind, so
your project does not need any of them.

<!-- tabs -->

**bun**

```sh
bun add -d svelte-edda
```

**npm**

```sh
npm install -D svelte-edda
```

**pnpm**

```sh
pnpm add -D svelte-edda
```

<!-- /tabs -->

## Write a page

Create `docs/index.md`:

```md
# My library

A short introduction.
```

Every `.md` file in `docs/` becomes a page. See [Pages and navigation](./writing/index.md) for
how files map to URLs and the sidebar.

## Add a config

The config is optional for a first look, but you will want a title. Create
`svelte-edda.config.ts` in the project root:

```ts
import { defineConfig } from 'svelte-edda';

export default defineConfig({
	title: 'My library',
	description: 'What it does, in one sentence.',
	repository: 'https://github.com/me/my-library'
});
```

All options are listed in [Configuration](./configuration.md).

## Commands

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `svelte-edda dev`      | Starts the dev server; pages reload when you save.               |
| `svelte-edda build`    | Builds the static site into `dist/`, including the search index. |
| `svelte-edda preview`  | Serves the built site.                                           |
| `svelte-edda check`    | Validates components, alerts, links and live demos.              |
| `svelte-edda guide`    | Prints how to write this project's docs, for people and agents.  |
| `svelte-edda generate` | Runs the [generators](./generated-pages.md) of the config.       |

Add them to `package.json`:

```json
{
	"scripts": {
		"docs:dev": "svelte-edda dev",
		"docs:build": "svelte-edda build",
		"docs:check": "svelte-edda check"
	}
}
```

> [!TIP]
> Run `svelte-edda check` in CI. It fails on a broken link or a misspelled component long before
> anyone sees the page.

If coding agents edit your docs, tell them about the last two commands: see
[AI agents](./ai-agents.md#editing-docs-with-an-agent).
