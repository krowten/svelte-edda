---
sidebar: Deployment
title: Deploy docs to GitHub Pages or any static host
description: Publish the documentation site to GitHub Pages with GitHub Actions, or to Netlify, Cloudflare Pages or any other static host.
---

# Deployment

`svelte-edda build` writes a static site to `dist/`. Any static host can serve it.

## GitHub Pages

For a project site at `https://<user>.github.io/<repo>/`, set `base`:

```ts
export default defineConfig({
	title: 'My library',
	base: '/my-repo/',
	site: 'https://me.github.io'
});
```

Then add `.github/workflows/docs.yml`:

```yaml
name: Docs

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
        with:
          # archived versions and the sitemap's dates come from the git history
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx svelte-edda check
      - run: bunx svelte-edda build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v5
```

In the repository settings, under **Pages**, set the source to **GitHub Actions**.

> [!NOTE]
> The build writes `404.html` and an empty `.nojekyll`, which GitHub Pages needs to serve the
> missing-page screen and the `_docs` folder.

## Other static hosts

Netlify, Cloudflare Pages, Vercel or your own web server need the same two settings: the build
command `npx svelte-edda build` (or `bunx svelte-edda build`) and the output directory `dist`.
Every page is a folder with an `index.html`, so no rewrite rules are needed. Serve `404.html`
for missing pages; Netlify and Cloudflare Pages pick it up by themselves, and nginx needs
`error_page 404 /404.html;`.

On a domain of its own, leave `base` at `/` and set `site` to the domain. The build then also
writes `robots.txt`, which search engines only read at the root of a host. Archived versions and
the sitemap's dates come from git history, so the build needs the full history, not a shallow
clone.

## Search

The search index is built from the generated HTML at the end of `svelte-edda build`. In
`svelte-edda dev` the search dialog says so instead of returning results.
