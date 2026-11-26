# svelte-edda

A documentation engine: a `docs/` folder of plain Markdown becomes a static site rendered with
Svelte 5 and Vite. Published to npm as `svelte-edda`; users run it through the `svelte-edda`
command and need neither Svelte nor Vite in their own project.

## Layout

- `src/cli.ts`, `src/dev.ts`, `src/build.ts`, `src/check.ts`: the commands
- `src/config.ts`, `src/types.ts`: `svelte-edda.config.ts` and its resolved form
- `src/pages.ts`: scans the docs directory into pages, languages and the sidebar
- `src/versions.ts`: archived versions extracted from git tags
- `src/markdown/`: the unified pipeline (comment markers, alerts, links, Shiki, components)
- `src/guide.ts`: `svelte-edda guide`, the writing guide generated from the config
- `src/render.ts`: renders pages through Vite's SSR runner and writes the HTML document
- `src/theme/`: the default layout and its CSS; `src/components/`: built-in components
- `src/client/`: the browser script (theme, search, menus, island hydration)
- `src/i18n/`: interface strings in MessageFormat 2
- `docs/`: this project's documentation, built by the engine itself
- `test/`: unit tests and fixture sites; `e2e/`: Playwright against the built fixtures

## Commands

```sh
bun run dev          # docs/ on the dev server
bun run lint         # prettier + eslint
bun run check        # bun check + svelte-check
bun test             # unit tests, build the fixture sites
bun run test:e2e     # Playwright: builds the fixtures, drives them in Chromium, axe scan
bun run smoke:pack   # installs the packed tarball with npm, Bun and pnpm and builds a site
```

Use Bun for everything in this repository: `bun install`, `bun run`, `bunx`, `bun test`.

## Rules of the code

- The engine is published for Node users (`engines.node >= 22.18`), so `src/` uses `node:*` APIs
  and never Bun's. Bun APIs are fine in `scripts/` and tests.
- Functions over classes, `type` over `interface`, type imports in their own statements above
  value imports.
- The styles of an element are the Tailwind utilities in its markup, also in markup built in code
  (`alerts.ts`, `code.ts`, `blocks.ts`, `render.ts`): no custom classes made of utilities, no
  `@apply`. Prefer the standard palette, sizes and spacing; brackets only for what has no other
  spelling, and before a custom class. A class or `data-*` attribute may serve as a hook
  (`docs-code`, `docs-children`, `data-alert`), without styles of its own.
- Every interface string goes through `t()` and exists in `src/i18n/messages.ts` for `en`, `ru`
  and `de`; `en` holds the reference keys. Built-in components too: their words live in
  `messages.ts`, not in a dictionary keyed by `lang` as user components do. None has words yet;
  the first one that does gets the translator through `PrepareContext` and passes its strings as
  props.
- Elements a test needs get a `data-testid`; tests locate by role or test id, never by classes
  or translated text.
- New behaviour needs a test that fails without it. Anything about the generated site is tested
  against a fixture in `test/fixtures`; behaviour in the browser goes to `e2e/site.spec.ts`.
- A change users can observe updates `docs/` and `CHANGELOG.md` in the same commit. New syntax
  also goes into `src/guide.ts`: it is what an agent in another project reads.
- An author's mistake is a diagnostic with file and line (`reportError`), never a thrown error
  or text silently printed as it is.

## Things that bite

- `bunfig.toml` pins the install registry to npm. Without it a local `.npmrc` that points npm at
  a private registry leaks that registry's URLs into `bun.lock`, and CI cannot install.
- `bin/svelte-edda.js` is committed and imports `dist/cli.js`: npm drops a `bin` entry whose file
  does not exist when it reads the manifest, which is before `prepack` builds `dist/`.
- Vite strips `base` from `req.url`; the dev middleware reads `originalUrl`, and adds the Vite
  client by hand because `transformIndexHtml` would prefix `base` a second time.
- `prose` is a utility too, sorted by its first property: inside an article `m-*` and `my-*` come
  before it and lose, `mt-*` and `mb-*` come after it and win.
- An important rule in a CSS layer beats unlayered CSS: overrides of Tailwind's preflight
  (`[hidden]`) live in `@layer base`.
- Live demos and user components import the documented library by its package name and get the
  working copy; Svelte itself is resolved once, from the project first (`singleSvelte` in
  `src/vite.ts`).

## Svelte

`.claude/settings.json` enables the official `svelte` plugin (marketplace `sveltejs/ai-tools`):
its MCP server serves the Svelte 5 documentation and `svelte-autofixer`, and its skills cover
writing Svelte code. This project is plain Svelte without SvelteKit, so ignore SvelteKit advice.
Run `svelte-autofixer` on Svelte code you write and fix what it reports:

```sh
npx @sveltejs/mcp svelte-autofixer src/theme/Layout.svelte --svelte-version 5
```
