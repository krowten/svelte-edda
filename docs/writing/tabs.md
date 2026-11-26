---
description: Show variants of the same content, such as package manager commands.
---

# Tabs

Tabs show variants of the same content: commands for different package managers, the same example
in TypeScript and JavaScript.

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

Each variant starts with a line in bold; everything up to the next bold line belongs to it. A
variant can hold any Markdown, not only code.

## On GitHub

GitHub hides HTML comments, so the same file shows each label in bold followed by its content.
Agents and the `.md` version of the page see the same plain text.

## Remembering the choice

Tab groups with the same labels switch together and remember the choice across pages. Pick `bun`
once and every install command on the site shows Bun. To group tabs with different labels, give
them the same `sync` key:

```md
<!-- tabs sync="language" -->
```

## Without JavaScript

The page is fully rendered on the server. Without JavaScript every variant is shown one after
another, each with its label.
