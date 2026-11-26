# Contributing

Thanks for taking a look. Issues and pull requests are both welcome. Taking part means
following the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

```sh
bun install
bun run dev        # this repository's documentation on the dev server
```

The engine lives in `src/`: the CLI and build in `src/*.ts`, the Markdown pipeline in
`src/markdown`, the built-in components in `src/components`, the default theme in `src/theme`
and the browser code in `src/client`. `docs/` is the documentation, built by the engine itself,
and `test/fixtures` holds small sites the tests build.

## Before you open a pull request

```sh
bun run lint
bun run check
bun test
bun run test:e2e
bun run smoke:pack
```

`test:e2e` builds the fixture sites and drives them in Chromium with Playwright: tabs, demos,
search, menus, the page without JavaScript and an axe accessibility scan in both color schemes.
`smoke:pack` packs the tarball, installs it into throwaway projects with npm, Bun and pnpm and
builds a site there: the only check that sees the package the way users get it.

## House style

- Prettier and ESLint decide formatting and lint; run `bun run format` rather than arguing
  with them.
- Prefer functions over classes, and `type` over `interface` unless declaration merging is
  the point.
- The engine runs under Node as well as Bun, so `src/` uses `node:*` APIs, not Bun's.
- The theme uses Tailwind's standard palette and scale only, no arbitrary values.
- Comments explain constraints the code can't show. Skip the ones that narrate what the
  next line does.

## Tests

New behaviour needs a test that fails without it. Unit tests live in `test/*.test.ts` and run with
`bun test`; anything about the generated site belongs in `test/build.test.ts` against a fixture.

## Documentation

The documentation lives in `docs/`. If a change alters behaviour a user can observe, the docs
change with it in the same pull request.
