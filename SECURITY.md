# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub's advisory form](https://github.com/krowten/svelte-edda/security/advisories/new)
rather than in a public issue. Include what you did, what happened, and the version you
were running.

## Supported versions

The package is pre-1.0. Fixes land on the latest release; older versions are not patched.

## What to keep in mind

**Documentation is trusted input.** Raw HTML in Markdown is passed through to the page, live
demos are compiled and run as code, and `svelte-edda.config.ts` is executed. Build documentation
only from sources you would also run as code, and review documentation pull requests the same
way.

**The output is static.** The site has no server side; search runs in the browser over a
prebuilt index, and nothing a reader types leaves the page.
