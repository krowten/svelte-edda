---
description: Add your own Svelte components and use them from Markdown.
---

# Custom components

A component pairs a marker you write in Markdown with a Svelte component that renders it. You
register both in one place, the config.

## Write the component

```svelte
<!-- components/Badge.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { tone = 'info', children }: { tone?: 'info' | 'new'; children?: Snippet } = $props();
</script>

<span class="bg-accent-100 text-accent-800 rounded px-2 py-0.5 text-sm" data-tone={tone}>
	{@render children?.()}
</span>
```

Tailwind classes work in your components: their folder is added to the scanned sources.

## Register it

```ts
import { defineComponent, defineConfig } from 'svelte-edda';

export default defineConfig({
	title: 'My library',
	components: [
		defineComponent({
			name: 'badge',
			component: 'components/Badge.svelte',
			description: 'Inline label for statuses such as "new".',
			attributes: {
				tone: { type: 'string', values: ['info', 'new'] }
			}
		})
	]
});
```

## Use it

```md
<!-- badge tone="new" -->

Added in **2.0**

<!-- /badge -->
```

The Markdown between the markers is rendered and passed as the `children` snippet. A Svelte
snippet made from HTML needs a single root element, so the content arrives wrapped in
`<div class="docs-children contents">`. The wrapper takes no box of its own, so a component
that lays its content out with grid or flex gets the paragraphs, lists and headings as items, not
the wrapper. A component without content closes itself:

```md
<!-- version-picker /-->
```

On GitHub the comments are hidden and only the content between them shows.

## Attributes

Attributes are written like HTML attributes: `name="value"` for strings, a bare `name` for
`true`. They arrive as props. Declare them to have `svelte-edda check` validate them:

| Field         | Meaning                              |
| ------------- | ------------------------------------ |
| `type`        | `'string'` (default) or `'boolean'`  |
| `values`      | Allowed values of a string attribute |
| `required`    | The attribute must be present        |
| `description` | Shown by `svelte-edda guide`         |

Without `attributes`, anything is passed through unchecked.

The component's own `description` and `example` (Markdown showing it in use) are printed by
`svelte-edda guide`, which is how a person or a [coding agent](./ai-agents.md) new to the
project learns that the component exists.

Content inside a component inherits the article's typography. A component that styles its own text,
such as a badge or a card, should add Tailwind Typography's `not-prose` class to its root.

A component's `<style>` block works as in any Svelte component, whether it is interactive or not:
its scoped CSS is written into the `<head>` of every page that uses it.

## Translated components

Every component gets `lang`, the language of the page (`en`, `pt-BR`), as a prop, whether or not
it declares attributes; `prepare` gets it too. The content between the markers is already in the
page's language, because each language has its own files, so `lang` is for the words written in
the component itself:

```svelte
<script lang="ts">
	let { lang }: { lang: string } = $props();

	const label = { en: 'New', ru: 'Новое' }[lang] ?? 'New';
</script>

<span class="not-prose">{label}</span>
```

On a page shown untranslated, `lang` is the language of the section it is shown in, as in the
page's `<html lang>`, so the component's words match the rest of the interface. The name is the
engine's: a marker with a `lang` attribute is an error, and so is a component that declares one.

## Interactive components

By default a component renders to HTML on the server and ships no JavaScript. Set
`interactive: true` to hydrate it in the browser as an island:

```ts
defineComponent({
	name: 'counter',
	component: 'components/Counter.svelte',
	interactive: true
});
```

Props of an interactive component travel to the browser as JSON, so they must be serializable.
The built-in [tabs](./writing/tabs.md) are an interactive component.

## Shaping the content: `prepare`

`prepare` turns the marker and its rendered content into props, for components that need structure
rather than a single `children` snippet. It receives:

- `attributes`: the parsed attributes;
- `children`: the content as [hast](https://github.com/syntax-tree/hast) nodes;
- `toHtml(nodes)`: renders nodes to an HTML string;
- `error(message)`: reports a problem at the marker, failing `check` and `build`.

This one takes a numbered list and nothing else:

```ts
defineComponent({
	name: 'timeline',
	component: 'components/Timeline.svelte',
	prepare({ children, toHtml, error }) {
		const items = children.filter((node) => node.type === 'element' && node.tagName === 'ol');
		if (items.length !== 1) error('put a single numbered list inside <!-- timeline -->');
		return { html: toHtml(items) };
	}
});
```

A string `children` prop returned from `prepare` becomes the `children` snippet.

## Replacing a built-in component

Register a component with the same name (`tabs`, `cards`, `steps` or `hero`) and yours is used
instead, with your attributes and `prepare`.
