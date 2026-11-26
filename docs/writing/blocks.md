---
sidebar: Cards, steps, hero
title: Cards, steps and a hero in plain Markdown
description: Built-in components for a landing page and for instructions, written as ordinary Markdown between two comments and shipped without JavaScript.
---

# Cards, steps and hero

Three more components come with the engine. Like [tabs](./tabs.md) they are ordinary Markdown
between two comments, which GitHub hides; unlike tabs they ship no JavaScript. They take no
attributes.

## Cards

Start each card with a line in bold. Everything up to the next bold line belongs to the card. When
the title is a link, the whole card is clickable.

```md
<!-- cards -->

**[Getting started](../getting-started.md)**

Install the package and write the first page.

**Typed**

Wrong attributes fail `check`.

<!-- /cards -->
```

<!-- cards -->

**[Getting started](../getting-started.md)**

Install the package and write the first page.

**Typed**

Wrong attributes fail `check`.

<!-- /cards -->

Cards stand two in a row, and below each other on phones. Text before the first bold line is an
error.

## Steps

Put one numbered list inside, and nothing else. An item can hold anything a list item can, such as
a code block indented to the item's text.

````md
<!-- steps -->

1. Install the package.

   ```sh
   npm install -D svelte-edda
   ```

2. Write `docs/index.md`.
3. Start the dev server.

<!-- /steps -->
````

<!-- steps -->

1. Install the package.

   ```sh
   npm install -D svelte-edda
   ```

2. Write `docs/index.md`.
3. Start the dev server.

<!-- /steps -->

## Hero

The opening of a [landing page](./index.md#landing-pages): a title, a few words, and links.

````md
---
layout: landing
---

<!-- hero -->

# My library

What it does, in one sentence.

[Get started](./getting-started.md) [GitHub](https://github.com/you/my-library)

```ts
import { start } from 'my-library';
```

<!-- /hero -->
````

- A paragraph of nothing but links becomes a row of buttons, the first one filled. A link inside a
  sentence stays a link.
- A code block, an image, or a component such as tabs or a live demo at the very end stands beside
  the text on wide screens, and below it on narrow ones.
- The `# Heading` is the page's title, as on any other page.

## Your own instead

Register a component named `cards`, `steps` or `hero` and yours is used, see
[replacing a built-in component](../custom-components.md#replacing-a-built-in-component).
