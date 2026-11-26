---
sidebar: AI agents
title: Documentation for AI agents, with llms.txt and Markdown pages
description: llms.txt, llms-full.txt and a Markdown copy of every page, plus a checker and a writing guide that keep AI agents on your docs syntax.
---

# AI agents

Agents read Markdown better than HTML, so the site serves both.

- **`/<page>.md`** for every page: the source Markdown with links rewritten to other `.md` URLs.
  Each HTML page points to it with `<link rel="alternate" type="text/markdown">` and a
  "View as Markdown" link.
- **`llms.txt`**: an index of all pages with their descriptions, following
  [llmstxt.org](https://llmstxt.org).
- **`llms-full.txt`**: the whole documentation in one file, in sidebar order.

Because pages are plain Markdown, tools that index repositories directly, such as
[Context7](https://context7.com), read the same text as the site. Context7 indexes English text
only.

## Keeping docs agent-friendly

- Give every page a `description`; it appears in `llms.txt`.
- Keep content in the Markdown. A component that generates text from attributes hides that text
  from anyone reading the source.
- Write examples as code blocks. A [live demo](./writing/live-demos.md) is still a code block
  in the source.

## Editing docs with an agent

An agent that has never seen svelte-edda does not know that tabs are comment markers, and will
reach for the syntax of the tools it has seen more of. Two commands close that gap:

- **`svelte-edda guide`** prints, as Markdown, how this project's docs are written: where pages
  go, the Markdown that is supported, and every component of the project with its attributes and
  an example. It is generated from the config, so your own components are in it.
- **`svelte-edda check`** verifies the result and reports each problem with file and line.

Put both into the instructions your agent reads (`AGENTS.md`, `CLAUDE.md` or the like):

```md
The documentation in `docs/` is built with svelte-edda. Before editing it, run
`npx svelte-edda guide` and follow what it prints. After editing, run `npx svelte-edda check`
and fix everything it reports.
```

The full documentation of svelte-edda is also in the installed package, at
`node_modules/svelte-edda/docs/`, for an agent that needs more than the guide.

### What `check` catches

| Mistake                                                     | Example                                  |
| ----------------------------------------------------------- | ---------------------------------------- |
| Syntax of other tools, which would be printed as text       | `:::tip`, `<Tabs>`, `{% tabs %}`         |
| A marker that is never closed, or closed without an opening | `<!-- tabs -->` alone                    |
| An unknown, missing or invalid attribute                    | `<!-- badge tone="loud" -->`             |
| Content a component cannot use                              | Tabs without a bold label line           |
| An alert type GitHub does not have                          | `> [!WARN]`                              |
| A link to a file that is not there                          | `[Install](./instal.md)`                 |
| A link to a heading that is not there                       | `[Usage](./install.md#usege)`            |
| A live demo that does not compile                           | A missing brace in a `svelte live` block |

`build` reports the same, and also a component or demo that throws while rendering. To show
one of the foreign constructs as text, put it in a code span.

A link's `#fragment` is checked against the headings of the target page and the ids written in
its HTML, so an anchor that no heading provides needs `<a id="name"></a>` in the Markdown.

### Describe your components

`guide` can only repeat what the config says. Give every component a `description` and, when its
content has a shape of its own, an `example`:

```ts
defineComponent({
	name: 'badge',
	component: 'components/Badge.svelte',
	description: 'Inline label for the status of a feature.',
	example: '<!-- badge tone="new" -->\n\nSince 2.0\n\n<!-- /badge -->',
	attributes: {
		tone: { values: ['info', 'new'], required: true, description: 'Colour of the label.' }
	}
});
```
