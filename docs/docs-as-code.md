---
sidebar: Docs as code
title: Docs as code with Markdown, git and CI
description: What docs as code means, and a working setup for it, with Markdown next to the code, review in pull requests, checks in CI and versions from git tags.
---

# Docs as code

Docs as code means documentation is written, reviewed, tested and released the way code is: as
plain text in the repository, changed in pull requests, checked by CI and published by a build. A
change to the code and to its documentation is then one change.

This page sets it up with svelte-edda, for a library whose code and docs share a repository.

<!-- steps -->

1. **Keep the docs beside the code.**

   ```
   my-library/
     docs/
       index.md
       guide/install.md
     src/
     package.json
     svelte-edda.config.ts
   ```

   The pages are ordinary Markdown, so a reviewer reads them on GitHub without building anything.
   See [getting started](./getting-started.md).

2. **Make docs part of the change.** A pull request that changes behaviour changes the page that
   describes it. Say so in `CONTRIBUTING.md`, and show agents the syntax:

   ```md
   The documentation in `docs/` is built with svelte-edda. Before editing it, run
   `npx svelte-edda guide` and follow what it prints. After editing, run `npx svelte-edda check`
   and fix everything it reports.
   ```

3. **Test the docs in CI.** `svelte-edda check` fails on a broken link or anchor, a misspelled
   component, an attribute that does not exist, a live demo that does not compile. Put it beside
   the other checks, in `.github/workflows/ci.yml`:

   ```yaml
   name: CI
   on: [pull_request]

   jobs:
     docs:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v7
           with:
             # archived versions come from git tags
             fetch-depth: 0
         - uses: oven-sh/setup-bun@v2
         - run: bun install --frozen-lockfile
         - run: bunx svelte-edda check
   ```

4. **Generate what can be generated.** A reference copied by hand goes stale. Write it with a tool
   and commit the result: with `commit: true`, `check` compares the committed pages with fresh
   output, and an outdated reference fails the pull request.

   ```ts
   import { defineConfig, svelteComponents } from 'svelte-edda';

   export default defineConfig({
   	title: 'My library',
   	generate: [
   		svelteComponents({ dir: 'components', components: ['src/lib/*.svelte'], commit: true })
   	]
   });
   ```

   See [generated pages](./generated-pages.md) for TypeDoc and other tools.

5. **Publish on merge.** A push to `main` builds the site and deploys it, see
   [deployment](./deployment.md).

6. **Archive a release with its tag.** The docs of an older version are the docs directory at that
   tag, so there is nothing to copy:

   ```ts
   export default defineConfig({
   	title: 'My library',
   	versions: [{ tag: 'v1.9.0', label: '1.x' }]
   });
   ```

   See [versions](./versions.md).

<!-- /steps -->

## What to check for in review

- The page says what changed for the reader, not how the code changed.
- Every new option is there with its default, and every new error with what to do about it.
- Code samples run. A ` ```svelte live ` block is compiled by `check`; other samples are not, so
  try them.
- The page has a `description`: search engines and `llms.txt` show it.

## Where it does not fit

Docs as code asks every author to use git. When most of the writing is done by people who do not,
such as support or marketing, a hosted platform with an editor serves them better: see
[GitBook and Mintlify](./comparison/gitbook-mintlify.md).
