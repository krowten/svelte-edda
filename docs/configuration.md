---
description: Every option of svelte-edda.config.ts.
---

# Configuration

svelte-edda reads `svelte-edda.config.ts` (or `.js`, `.mjs`) from the project root. Run the CLI with
`--root <dir>` to use another directory.

```ts
import { defineConfig } from 'svelte-edda';

export default defineConfig({
	title: 'My library'
});
```

## Options

| Option          | Type                             | Default            | Description                                                                                               |
| --------------- | -------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `title`         | `string`                         | required           | Site title, shown in the header and page titles.                                                          |
| `description`   | `string`                         |                    | Home page description; also the summary line of `llms.txt`.                                               |
| `docsDir`       | `string`                         | `'docs'`           | Directory with the Markdown sources.                                                                      |
| `outDir`        | `string`                         | `'dist'`           | Build output directory.                                                                                   |
| `base`          | `string`                         | `'/'`              | Public base path, e.g. `'/my-repo/'` for a GitHub Pages project site.                                     |
| `site`          | `string`                         |                    | Site origin such as `'https://me.github.io'`, without the `base` path, for absolute URLs and the sitemap. |
| `repository`    | `string`                         |                    | Repository URL: adds the header link and "Edit this page".                                                |
| `branch`        | `string`                         | `'main'`           | Branch for "Edit this page" links; their paths start at the git root.                                     |
| `logo`          | `{ src, dark? }`                 |                    | Logo shown instead of the title in the header, see [Theming](./theming.md#logo).                          |
| `css`           | `string \| string[]`             |                    | Stylesheets imported after the default theme.                                                             |
| `head`          | `string[] \| (page) => string[]` |                    | Raw HTML added to every page's `<head>`, see [below](#tags-per-page).                                     |
| `components`    | `ComponentDefinition[]`          |                    | Your components, see [Custom components](./custom-components.md).                                         |
| `lang`          | `string`                         | `'en'`             | Language of single-language docs: `<html lang>` and the interface strings.                                |
| `locales`       | `Record<string, LocaleConfig>`   |                    | Languages, one folder each, see [Languages](./languages.md).                                              |
| `defaultLocale` | `string`                         | first              | Language served without a prefix and shown for untranslated pages.                                        |
| `messages`      | `Record<string, Messages>`       |                    | Interface strings in MessageFormat 2, by language.                                                        |
| `versions`      | `VersionConfig[]`                |                    | Archived versions from git tags, see [Versions](./versions.md).                                           |
| `publicDir`     | `string`                         | `'public'`         | Files copied to the site root as they are.                                                                |
| `ogImage`       | `string`                         |                    | Social preview image: a file in `publicDir` or a URL.                                                     |
| `nav`           | `NavLink[]`                      |                    | Header links, see [The sidebar](./writing/index.md#the-sidebar).                                          |
| `sidebar`       | `SidebarEntry[]`                 | the docs directory | Pages of the sidebar in order, see [The sidebar](./writing/index.md#the-sidebar).                         |
| `generate`      | `Generator[]`                    | `[]`               | Tools that write pages, see [Generated pages](./generated-pages.md).                                      |

Paths are relative to the config file.

## Static files and search engines

Everything in `publicDir` is copied to the root of the site: `robots.txt`, a social preview image,
downloads. Icons named `favicon.svg`, `favicon.ico`, `favicon.png` and `apple-touch-icon.png`
there are linked from every page automatically.

Every page gets a description, Open Graph and Twitter tags from its title and description, and
`hreflang` links to its translations. Search engines and AI crawlers need absolute URLs for the
rest, so it comes with `site`:

- a canonical URL, and `og:url` and `ogImage` as absolute URLs;
- structured data (JSON-LD): `WebSite` on home pages, `TechArticle` with the date of the last
  commit and a `BreadcrumbList` built from the sidebar on the others;
- `sitemap.xml` with the date of each page's last commit;
- `robots.txt` pointing at the sitemap, unless `publicDir` has its own. Crawlers read it only at
  the root of a host, so a site under a `base` path gets none: submit its sitemap in the search
  engines' consoles instead.

`svelte-edda check` warns when `site` is missing. Pages show the date of their last commit at the
bottom too; in CI, fetch the history (`fetch-depth: 0`), or every page gets the date of the latest
commit.

Search engines are pointed at one copy of each page: archived versions and the 404 page carry
`noindex`, and a page shown in the default language for lack of a translation names the original
as its canonical URL and carries neither translations nor structured data.

### Tags per page

Other tags, such as a search console verification, go in `head`. A function gets the page and
returns the tags for it, which is how to add structured data of your own, such as a description
of the library on the home page:

```ts
export default defineConfig({
	title: 'My library',
	site: 'https://me.github.io',
	head: (page) => [
		'<meta name="google-site-verification" content="…" />',
		page.slug === ''
			? `<script type="application/ld+json">${JSON.stringify({
					'@context': 'https://schema.org',
					'@type': 'SoftwareSourceCode',
					name: 'My library',
					codeRepository: 'https://github.com/me/my-library',
					programmingLanguage: 'TypeScript'
				})}</script>`
			: ''
	]
});
```

| Field          | Content                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| `title`        | Text of the page's `<title>`.                                                   |
| `description`  | The page's description, from frontmatter or its first paragraph.                |
| `url`          | The page's URL, absolute when `site` is set.                                    |
| `lang`         | Language tag of the page.                                                       |
| `slug`         | Path without base and language: `''` for the home page, `guide/install`, `404`. |
| `lastModified` | Date of the page's last commit, `YYYY-MM-DD`.                                   |
| `version`      | Label of the archived version the page belongs to.                              |

## Generated files

Generated CSS, the client entry, compiled demos and extracted versions live in
`node_modules/.svelte-edda`. The build writes:

| Path                    | Content                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `<page>/index.html`     | Every page, rendered to static HTML.                                 |
| `<page>.md`             | The page's Markdown, with links pointing at the served `.md` files.  |
| `llms.txt`              | Index of the Markdown pages, see [llmstxt.org](https://llmstxt.org). |
| `llms-full.txt`         | All pages in reading order.                                          |
| `pagefind/`             | Search index built by [Pagefind](https://pagefind.app).              |
| `404.html`, `.nojekyll` | For GitHub Pages.                                                    |
| `sitemap.xml`           | All pages of the latest version, when `site` is set.                 |
| `robots.txt`            | A pointer to the sitemap, when `site` is set and `base` is `/`.      |
| `v/<slug>/`             | Archived versions.                                                   |
