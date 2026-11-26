---
description: How Markdown files become pages, URLs and the sidebar.
---

# Pages and navigation

## Files and URLs

Every `.md` file in the docs directory is a page. The path becomes the URL:

| File                          | URL               |
| ----------------------------- | ----------------- |
| `docs/index.md`               | `/`               |
| `docs/guide/index.md`         | `/guide/`         |
| `docs/guide/install.md`       | `/guide/install/` |
| `docs/10-guide/20-install.md` | `/guide/install/` |

`README.md` works as a folder's index too, so the folder reads well when browsed on GitHub.
Files and folders starting with `.` or `_` are skipped.

## The sidebar

List the pages in `sidebar` in the config, grouped under headings:

```ts
export default defineConfig({
	title: 'My library',
	nav: [
		{ text: 'Guide', link: 'guide/install.md' },
		{ text: 'GitHub', link: 'https://github.com/me/my-library' }
	],
	sidebar: [
		'index.md',
		{ text: 'Guide', items: ['guide/install.md', 'guide/streams.md'] },
		{ text: 'Reference', items: ['api.md', { text: 'Changelog', link: 'https://…' }] }
	]
});
```

An entry is one of:

- a page's file, relative to the docs directory, named in the sidebar by its `sidebar` or title;
- `{ text, link }`: a page under a name of its own, or an external URL;
- `{ text, items }`: a group, which can hold groups too;
- `{ text, dir }`: a group of every page in a folder, ordered as without a `sidebar` option
  (below). Suits a large reference section, such as a page per API method, where the order by
  title is the natural one. Its pages count as listed.

Every group can be closed with the arrow beside its name; the choice lasts for the session. Add
`collapsed: true` to a group to start it closed. A group holding the current page is always open,
and without JavaScript every group is. A long sidebar scrolls to the current page.

```ts
sidebar: [
	{ text: 'Guide', items: ['guide/install.md', 'guide/streams.md'] },
	{ text: 'API', dir: 'api', collapsed: true }
];
```

Files keep plain names, and the previous and next links follow the sidebar. In translated docs a
file is relative to the language folder, and a name can be given per language:
`text: { en: 'Guide', ru: 'Руководство' }`. A language without its own text uses the default
language's, and `check` warns about it.

`nav` puts links in the header, beside the site title; on phones they move into the menu. A
header link is marked as current on its page and on the other pages of its sidebar group.

`check` and `build` fail on an entry that names no page, and `check` warns about a page the
sidebar leaves out. Set `sidebar: false` in a page's frontmatter to leave it out on purpose: it is
still built and can be linked to.

### Without a `sidebar` option

The sidebar then follows the docs directory. Folders become groups, and a numeric prefix such as
`10-` orders pages and folders and is dropped from the URL. Leave gaps between numbers so a page
can be inserted later without renaming the rest. Pages without a prefix come after numbered ones,
sorted by title. The `order` frontmatter field overrides the prefix:

```md
---
order: 5
---
```

Archived [versions](../versions.md) are always laid out this way: the option names the files of the
working tree, which an old tag may not have.

## Titles and descriptions

A page needs no frontmatter: its first `# Heading` is the heading on the page, the name in the
sidebar and the browser title. When a page does not open with its `# Heading` (frontmatter and
plain comments such as `<!-- prettier-ignore -->` may come before it, a component may not), the
layout shows the title as the page's heading instead. Each can be set on its own:

```md
---
title: How to install My library
sidebar: Installation
description: Shown in search engines and in llms.txt.
---

# Install
```

| Field         | Used for                                                          | Default                   |
| ------------- | ----------------------------------------------------------------- | ------------------------- |
| `title`       | `<title>` (followed by the site title), social cards, `llms.txt`. | The first `# Heading`.    |
| `sidebar`     | The sidebar and the previous/next links; `false` leaves it out.   | `title`.                  |
| `description` | The description tag, social cards, `llms.txt`.                    | See below.                |
| `order`       | Position in the sidebar.                                          | The file's `10-` prefix.  |
| `slug`        | The page's URL path, e.g. `streams` for `/streams/`.              | The file's path.          |
| `layout`      | `landing` for a [landing page](#landing-pages).                   | The docs layout.          |
| `editUrl`     | Where "Edit this page" leads.                                     | The file in `repository`. |

A page without `description` is described in search results and social cards by its first
paragraph of text, cut to 160 characters; the home page uses the site's `description` first.
`llms.txt` does the same for pages people write; a [generated page](../generated-pages.md) is listed
there with the `description` its generator wrote, or without one.

A page without a `# Heading` shows its `title` as the heading. The home page is named after the
site in the browser title unless it sets `title`. A `title` that already contains the site title
is used as it is, without the site title added after it. Search engines show about 60 characters of
it.

A folder's sidebar group takes its name from the folder's `index.md`. Without one, the folder
name is used: `getting-started` becomes "Getting started".

`slug` separates the URL from the sidebar: `docs/10-guide/20-streams.md` with `slug: streams`
stays in the "Guide" group and is served at `/streams/`. It also keeps a published URL alive
when a file moves. In translated docs, give every translation of the page the same `slug`.

## Landing pages

`layout: landing` gives a page the full width: no sidebar, no table of contents and no heading
added for it, and none of the edit link, date and previous/next links at the bottom. The header
links from `nav` lead into the docs; without them, the sidebar stays one click away behind the
menu button. Use it for a
home page built from a [hero and cards](./blocks.md) or your own
[components](../custom-components.md):

```md
---
title: Forms for Svelte without the boilerplate
layout: landing
---

<!-- hero -->

# My library

Forms without the boilerplate.

[Get started](./getting-started.md)

<!-- /hero -->

<!-- cards -->

**Typed**

The schema is the type.

**Accessible**

Labels and errors are wired up.

<!-- /cards -->
```

On GitHub the same file reads as a title, a sentence, a link and a few bold lines with text.

## Links and images

Link to other pages with relative paths to their files, as you would on GitHub:

```md
See the [install guide](./install.md#requirements).

![Architecture](./architecture.svg)
```

The site rewrites `install.md` to the page URL and serves images and other files from the docs
directory. Links stay correct in both places, and a link to a missing file fails `check` and
`build`.
