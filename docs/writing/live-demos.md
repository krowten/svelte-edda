---
description: Render a Svelte code block as a working component next to its source.
---

# Live demos

Add `live` to a `svelte` code block and the page shows the running component above its source:

````md
```svelte live
<script>
	let count = $state(0);
</script>

<button onclick={() => count++}>Clicked {count} times</button>
```
````

```svelte live
<script>
	let count = $state(0);
</script>

<button
	class="bg-accent-600 hover:bg-accent-700 rounded-md px-3 py-1.5 text-sm font-medium text-white"
	onclick={() => count++}
>
	Clicked {count}
	{count === 1 ? 'time' : 'times'}
</button>
```

The source stays an ordinary code block: on GitHub, in the npm package and for agents it is just an
example. On the site it is compiled, rendered on the server and hydrated in the browser.

## What a demo can use

- Svelte 5 runes and the full component syntax.
- Tailwind classes, including your theme's tokens such as `bg-accent-600`.
- Imports of installed packages, for example your own library: `import { connect } from 'my-library'`.

Relative imports such as `./Counter.svelte` do not work: the demo is compiled from a copy of the
code block, not from the page's folder. For a demo that needs its own files, register a
[custom component](../custom-components.md) instead.
