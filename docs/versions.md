---
sidebar: Versions
title: Versioned documentation
description: Keep the documentation of older releases online, built from git tags without copies of the docs in the repository.
---

# Versions

The documentation in your working tree is always the latest version: every change is on the site
as soon as it is built. Older releases are archived from their git tags, without copies of the
docs in the repository.

```ts
export default defineConfig({
	title: 'My library',
	versions: [
		{ tag: 'v2.3.1', label: '2.x' },
		{ tag: 'v1.9.0', label: '1.x' }
	]
});
```

Each version is the `docs/` directory as it was at its tag, built with the current theme and
served under `/v/<slug>/`: `/v/2.x/guide/install/`. The slug comes from the label unless you set
`slug`. Pages of an archived version say which version they belong to and link to the latest one;
the version menu in the header leads to the same page in another version, or to that version's
home page when the page does not exist there.

## What is archived

- Only the tags you list. Archive the last release of each line you still want readable, not every
  patch: versions that differ only by fixes need no separate documentation.
- An archived version is frozen. To correct it, tag a fix on a maintenance branch and point the
  version at the new tag.
- Search, `llms.txt` and the sitemap cover the latest version, and archived pages ask search
  engines not to index them.

## Requirements

- Git with the tags available. In CI, fetch the history: `actions/checkout` with
  `fetch-depth: 0`.
- The archived Markdown is built with today's components. When a component is renamed or removed,
  keep a definition for it. Problems in an archived version, such as a link that was already
  broken at the tag, are printed as warnings and do not fail the build.

`svelte-edda check` reports tags that do not exist. Extracted versions are cached in
`node_modules/.svelte-edda/versions`, one per commit.

## Context7

Context7 can index older versions from the same tags. List them under `previousVersions` in
`context7.json` to keep both in step:

```json
{ "previousVersions": [{ "tag": "v2.3.1" }, { "tag": "v1.9.0" }] }
```
