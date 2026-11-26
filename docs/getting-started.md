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
| `svelte-edda preview`  | Serves the built site, search included.                          |
| `svelte-edda check`    | Validates components, alerts, links and live demos.              |
| `svelte-edda guide`    | Prints how to write this project's docs, for people and agents.  |
| `svelte-edda generate` | Runs the [generators](./generated-pages.md) of the config.       |

Add them to `package.json`:

```json
{
	"scripts": {
		"docs:dev": "svelte-edda dev",
		"docs:build": "svelte-edda build",
		"docs:preview": "svelte-edda preview",
		"docs:check": "svelte-edda check"
	}
}
```

The commands take these options:

| Option          | Applies to       | What it does                                                                              |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `--root <dir>`  | all              | The project directory with `svelte-edda.config.ts`. Default: the current one.             |
| `--port <port>` | `dev`, `preview` | The port to listen on. Default: 5173 for `dev`, 4173 for `preview`, or the next free one. |
| `--host [host]` | `dev`, `preview` | Listens on all addresses, or on the given one, instead of only `localhost`.               |

`--host` is what makes the server reachable from a phone on the same network or from outside a
container: `svelte-edda preview --host --port 4173`.

> [!NOTE]
> Search needs the index that `svelte-edda build` writes, so the dev server has none: its search
> dialog says so instead of returning results. To try search, build and preview the site:
> `svelte-edda build && svelte-edda preview`.

> [!TIP]
> Run `svelte-edda check` in CI. It fails on a broken link or a misspelled component long before
> anyone sees the page.

If coding agents edit your docs, tell them about `svelte-edda guide` and `svelte-edda check`: see
[AI agents](./ai-agents.md#editing-docs-with-an-agent).
