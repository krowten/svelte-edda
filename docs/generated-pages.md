---
sidebar: Generated pages
title: API reference for TypeScript and Svelte, generated
description: Generate pages from Svelte 5 components, or with TypeDoc, pydoc-markdown or any command, before every build, keep them fresh in dev and check that committed ones are up to date.
---

# Generated pages

Some pages are written by a tool rather than by hand: an API reference from TypeDoc, the props of
your components, the help of a command line tool. The `generate` option runs such tools as part
of svelte-edda, so a plain `svelte-edda build` never ships a stale or missing reference, and
people and agents are told not to edit the result.

```ts
import { defineConfig } from 'svelte-edda';

export default defineConfig({
	title: 'My library',
	generate: [
		{
			dir: 'changelog',
			description: 'Copied from CHANGELOG.md in the repository root. Edit that file instead.',
			watch: ['CHANGELOG.md'],
			run: 'cp CHANGELOG.md {outDir}/index.md'
		}
	]
});
```

Each generator writes its pages into an empty folder the engine gives it, `outDir`. The engine then
makes `docs/<dir>/` hold exactly that output, so a page the tool stopped writing disappears too. The
folder keeps its permissions and owner, and a page is rewritten only when its content changed, so
an unchanged page keeps its modification time and file watchers see nothing.

| Field         | Type                 | Default | Meaning                                                                                          |
| ------------- | -------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `dir`         | `string`             |         | Folder inside the docs directory that holds the generated pages and nothing else.                |
| `description` | `string`             |         | Where the pages come from and what to edit instead. Shown in every page's source and the guide.  |
| `run`         | `string \| function` |         | A shell command with `{outDir}` in it, or `async ({ outDir, root }) => …`.                       |
| `watch`       | `string[]`           | `[]`    | Files and folders, relative to the config file, that make `dev` generate again when they change. |
| `commit`      | `boolean`            | `false` | Whether the generated pages are committed, see below.                                            |

In a command, `{outDir}` is replaced by the quoted path: write `{outDir}/index.md`, not
`"{outDir}"/index.md`. The command runs in the directory of the config file. A function gets the
same `outDir` and that directory as `root`; resolve paths against `root`, since the process may
have been started elsewhere (`svelte-edda build --root site`). With `locales`, `dir` includes the language folder:
`en/api`.

## When generators run

- **`svelte-edda build`** and **`svelte-edda check`** run every generator before reading the pages,
  so links into and out of generated pages are checked like any other.
- **`svelte-edda dev`** runs them on start and again when a file under `watch` changes; a burst of
  saves runs a generator once, and the browser reloads when its pages are written.
- **`svelte-edda generate`** runs them and does nothing else.

A generator that fails, a command that exits with an error or a function that throws, is reported
as an error with its output. `build` and `check` fail; `dev` keeps serving the pages from the last
run that worked.

## Committed or not

With `commit: false`, the default, the pages exist only in builds. Add the folder to `.gitignore`.
The site is complete, but whoever reads the repository instead of the site does not see the
pages: GitHub, [Context7](./ai-agents.md) and agents in other projects.

With `commit: true` the pages live in git, so the repository has the same text as the site. Run
`svelte-edda generate` after changing the source and commit the result. `svelte-edda check` then
generates into a temporary folder and compares, without touching your files: a page that was edited
by hand, is out of date, is missing, or does not belong in the folder is an error with its file
name. Run `check` in CI and an outdated reference fails the pull request. Archived
[versions](./versions.md) are built from git tags, so only committed generated pages appear in
them.

## What the engine adds

- **A notice in every page.** The first line under the frontmatter is
  `<!-- Generated, do not edit by hand. <description> -->`. GitHub hides it; anyone who opens the
  file sees it.
- **No "Edit this page" link** that leads to the generated file, where an edit would be overwritten.
  A page gets the link only when the generator writes `editUrl` into its frontmatter, for example
  pointing at the source file of the documented function.
- **A line in [`svelte-edda guide`](./ai-agents.md)** for each folder, with its `description`, so
  an agent edits the source rather than the output.
- **A safe folder.** If the folder holds a Markdown page without the notice, a page somebody wrote
  by hand, the generator leaves the folder alone and reports the page instead of deleting it.

A generator can also write `description` into each page's frontmatter: search results and
`llms.txt` show it, and agents decide from it which page to open.

## Svelte components

`svelteComponents` is a ready generator for libraries of Svelte 5 components: a page per component
with its props, snippets and exports, and an index.

```ts
import { defineConfig, svelteComponents } from 'svelte-edda';

export default defineConfig({
	title: 'My UI library',
	sidebar: ['index.md', { text: 'Components', dir: 'components', collapsed: true }],
	generate: [
		svelteComponents({
			dir: 'components',
			components: ['src/lib'],
			exclude: ['src/lib/internal', '**/*Demo.svelte'],
			commit: true
		})
	]
});
```

| Option        | Type       | Default            | Meaning                                                                         |
| ------------- | ---------- | ------------------ | ------------------------------------------------------------------------------- |
| `dir`         | `string`   |                    | Folder inside the docs directory for the pages, as in any generator.            |
| `components`  | `string[]` |                    | `.svelte` files, folders and masks, relative to the config file.                |
| `exclude`     | `string[]` | `[]`               | Files, folders and masks to leave out.                                          |
| `title`       | `string`   | `'Components'`     | Title of the index page.                                                        |
| `description` | `string`   | names `components` | As in any generator.                                                            |
| `watch`       | `string[]` | `[]`               | Files and folders that make `dev` generate again, beside those of `components`. |
| `commit`      | `boolean`  | `false`            | As in any generator.                                                            |

A folder is searched through and through, without `node_modules` and names that start with `.` or
`_`. A mask is a path with `*`, `**`, `?` or `{a,b}` in it, such as `src/lib/*.svelte` or
`packages/{core,extra}/**/*.svelte`. A file or folder that does not exist is an error, in `exclude`
too; a mask may match nothing. If nothing is left, that is an error.

Each component becomes one page. The path below the named folder, or below the folder where the mask
starts, becomes the address in kebab-case: `src/lib/form/TextField.svelte` is
`components/form/text-field.md`. Two components with one address are an error.

### What it reads

```svelte
<!--
	@component
	A button. Anything written here is Markdown on the component's page, code blocks included.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		/** What the button is for. */
		variant?: 'primary' | 'ghost';
		/** Whether it is pressed. */
		pressed?: boolean;
		/** @deprecated use `variant` */
		ghost?: boolean;
		/** Content of the button. */
		children: Snippet<[boolean]>;
	};

	let {
		variant = 'primary',
		pressed = $bindable(false),
		ghost,
		children,
		...rest
	}: Props = $props();

	/** Moves focus to the button. */
	export function focus() {}
</script>
```

| Source                                             | On the page                                                  |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `<!-- @component … -->`                            | Text under the title; its first paragraph is the description |
| Members of the type of `$props()`                  | Rows of "Props", with the type as written                    |
| JSDoc above a member, `@deprecated`                | Description                                                  |
| Default in the destructuring, `$bindable`          | "Default", and "(bindable)" beside the name                  |
| Members of type `Snippet`                          | Rows of "Snippets"                                           |
| `export function`, `export const` in the component | Rows of "Exports", what a parent reaches with `bind:this`    |
| `generics` of the script                           | "Type parameters"                                            |

Types are followed through intersections, `extends`, and imports and re-exports by a relative path or
SvelteKit's `$lib` (`src/lib` beside the config file).

### What it does not read yet

Nothing is guessed. What is out of reach is named, never listed wrongly:

- **Types from packages**, and types computed from others (`Omit`, `Partial`, unions, conditional
  types): the page says "Also takes the props of `Omit<Base, 'id'>`". A prop of such a type that the
  component destructures is listed without a type, and as neither required nor optional unless it
  has a default.
- **JavaScript components**: props are listed with their defaults and comments, without types.
- **Path aliases** other than `$lib`.
- **Components with `export let`** fail the generator with their name.
- Headings are in English.

Later versions will read more. The options, the addresses of pages and the headings "Props",
"Snippets" and "Exports" stay as they are, so links to `text-field.md#props` keep working and the
config needs no change; only cells that are empty today get filled. With `commit: true` run
`svelte-edda generate` after such an update and commit the result.

## Recipes

### TypeScript API reference with TypeDoc

[TypeDoc](https://typedoc.org) with [typedoc-plugin-markdown](https://typedoc-plugin-markdown.org)
writes one Markdown page per export, with relative `.md` links that svelte-edda follows.
typedoc-plugin-frontmatter writes the frontmatter that the hook below fills in.

```sh
npm install -D typedoc typedoc-plugin-markdown typedoc-plugin-frontmatter
```

```ts
import { join, relative } from 'node:path';

import { defineConfig } from 'svelte-edda';
import { Application, Comment, DeclarationReflection } from 'typedoc';
import { MarkdownPageEvent } from 'typedoc-plugin-markdown';

export default defineConfig({
	title: 'My library',
	repository: 'https://github.com/you/my-library',
	generate: [
		{
			dir: 'api',
			description:
				'API reference generated by TypeDoc from the JSDoc in src/. Edit the JSDoc instead.',
			watch: ['src'],
			commit: true,
			run: async ({ outDir, root }) => {
				const app = await Application.bootstrapWithPlugins({
					entryPoints: [join(root, 'src/index.ts')],
					tsconfig: join(root, 'tsconfig.json'),
					plugin: ['typedoc-plugin-markdown', 'typedoc-plugin-frontmatter'],
					out: outDir,
					name: 'API reference',
					readme: 'none',
					entryFileName: 'index',
					hidePageHeader: true,
					hideBreadcrumbs: true,
					useCodeBlocks: true
				});
				// Each page gets a description from its JSDoc, and "Edit this page" opens the file
				// that holds that JSDoc.
				app.renderer.on(MarkdownPageEvent.BEGIN, (page) => {
					const model = page.model;
					if (!(model instanceof DeclarationReflection)) return;
					const comment = model.comment ?? model.signatures?.[0]?.comment;
					const description =
						comment && Comment.combineDisplayParts(comment.summary).split('\n')[0];
					const source = model.sources?.[0];
					page.frontmatter = {
						...page.frontmatter,
						...(description && { description }),
						...(source && {
							editUrl: `https://github.com/you/my-library/edit/main/${relative(root, source.fullFileName).replaceAll('\\', '/')}`
						})
					};
				});
				const project = await app.convert();
				if (!project) throw new Error('TypeDoc could not read the sources');
				await app.generateOutputs(project);
			}
		}
	]
});
```

The `editUrl` above assumes the config file sits at the root of the repository; in a monorepo, make
the path relative to the repository root instead. Add the folder to the sidebar as a group,
`{ text: 'API', dir: 'api', collapsed: true }`, so new exports show up by themselves. As of
November 2026 TypeDoc supports TypeScript up to 6.0; a project already on a newer TypeScript keeps
TypeDoc and its own TypeScript in a separate folder with its own `package.json`, and puts the
config there.

The recipes below write a single `index.md`. List such a page in the sidebar by its file,
`'changelog/index.md'`, or as `{ text: 'Changelog', dir: 'changelog' }`, which becomes a plain link.

### Svelte components without runes

`svelteComponents` refuses components with `export let`.
[sveld](https://github.com/carbon-design-system/sveld) reads those, with slots and dispatched events,
and prints a table per component:

```ts
{
	dir: 'components',
	description: 'Generated by sveld from the components in src/lib. Edit their props and comments instead.',
	watch: ['src/lib'],
	run: 'npx sveld --entry src/lib/index.js --markdown --types=false --stdout > {outDir}/index.md'
}
```

### Changelog

The repository's `CHANGELOG.md` as a page of the site:

```ts
{
	dir: 'changelog',
	description: 'Copied from CHANGELOG.md in the repository root. Edit that file instead.',
	watch: ['CHANGELOG.md'],
	run: 'cp CHANGELOG.md {outDir}/index.md'
}
```

### Command line help

The help text of your own CLI, always the one it prints:

```ts
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const generator = {
	dir: 'cli',
	description: 'The output of `my-tool --help`. Edit the help text in src/cli.ts instead.',
	watch: ['src/cli.ts'],
	run: async ({ outDir, root }) => {
		const { stdout } = await promisify(execFile)('node', ['bin/my-tool.js', '--help'], {
			cwd: root
		});
		await writeFile(join(outDir, 'index.md'), `# Command line\n\n\`\`\`text\n${stdout}\`\`\`\n`);
	}
};
```

### Python API reference with pydoc-markdown

Any tool that writes Markdown works through a command. For a Python package,
[pydoc-markdown](https://github.com/NiklasRosenstein/pydoc-markdown) prints the docstrings of a
module:

```ts
{
	dir: 'python',
	description: 'Generated by pydoc-markdown from the docstrings in src/mypkg. Edit the docstrings instead.',
	watch: ['src/mypkg'],
	run: 'pydoc-markdown -I src -m mypkg > {outDir}/index.md'
}
```

## Keeping editors out of generated folders

The engine cannot stop an editor from writing a file, but your tools can:

- **Claude Code**: deny edits in `.claude/settings.json`:
  `{ "permissions": { "deny": ["Edit(docs/api/**)"] } }`.
- **VS Code**: open the files read-only with `"files.readonlyInclude": { "docs/api/**": true }` in
  `.vscode/settings.json`.
- **GitHub**: `docs/api/** linguist-generated=true` in `.gitattributes` folds the files in pull
  request diffs.
