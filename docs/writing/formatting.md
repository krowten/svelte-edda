---
sidebar: Formatting
title: Markdown formatting, GitHub alerts and code blocks
description: GitHub alerts (note, tip, important, warning, caution), highlighted code blocks, tables and other Markdown that works on the site and on GitHub.
---

# Formatting

Pages use [GitHub Flavored Markdown](https://github.github.com/gfm/): tables, task lists,
strikethrough and autolinks work as they do on GitHub.

## Code blocks

Fenced code blocks are highlighted with [Shiki](https://shiki.style) in light and dark themes and
get a copy button.

```ts
export function greet(name: string): string {
	return `Hello, ${name}!`;
}
```

## Alerts

Alerts use GitHub's own syntax, so they look the same on GitHub and on the site. There are five
types; any other, such as `[!WARN]`, is an error:

```md
> [!NOTE]
> Useful information that users should know, even when skimming.
```

> [!NOTE]
> Useful information that users should know, even when skimming.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent information that needs immediate attention to avoid problems.

> [!CAUTION]
> Advice about risks or negative outcomes of certain actions.

## HTML

Raw HTML passes through, for the rare case Markdown cannot express. Prefer a
[component](../custom-components.md) for anything you use more than once.
