---
sidebar: Languages
title: Multilingual documentation
description: Translate the documentation and its interface, with a folder per language, hreflang links and a fallback to the default language.
---

# Languages

## Folder per language

Declare the languages, then move the pages into a folder per language inside `docs/`:

```ts
export default defineConfig({
	title: 'My library',
	locales: {
		en: { label: 'English' },
		ru: { label: 'Русский' },
		de: { label: 'Deutsch' }
	}
});
```

```
docs/
  en/
    index.md
    guide/install.md
  ru/
    index.md
```

Every language keeps the same file layout. A file in another language is the translation of the
file at the same path in the default language, so links and images can stay relative.

The first language is the default; `defaultLocale` picks another one. It is served without a URL
prefix (`/guide/install/`), the others under their key (`/ru/guide/install/`). `lang` sets the
BCP 47 tag when it differs from the key, and `dir: 'rtl'` switches the direction:

```ts
locales: {
	en: { label: 'English' },
	'pt-br': { label: 'Português', lang: 'pt-BR' },
	ar: { label: 'العربية', dir: 'rtl' }
}
```

With `locales` set, every top-level entry of `docs/` must be a language folder; `svelte-edda check`
reports anything else. Documentation in a single language needs none of this: keep the pages in
`docs/` and set `lang` if it is not English.

## Untranslated pages

A page missing from a language is shown in the default language, at that language's URL, with a
notice. The sidebar of every language is complete, and translations can follow at their own
pace. Images missing from a translation's folder are taken from the default language's folder.
Such a page stays out of the sitemap and names the original as its canonical URL, so search
engines do not see the same text twice.

The language menu in the header leads to the same page in another language. Translated pages
announce each other with `<link rel="alternate" hreflang>`, and the search index is built per
language.

## Menus and components

Names in `nav` and `sidebar` can be given per language,
`text: { en: 'Guide', ru: 'Руководство' }`; a language without its own text uses the default
language's, and `check` warns about it. See [the sidebar](./writing/index.md#the-sidebar).

Your own components get the page language as the `lang` prop for the words in their markup; see
[translated components](./custom-components.md#translated-components).

## Interface strings

The interface (search, table of contents, page navigation, alerts) is translated into English,
Russian and German. A language without built-in strings gets the English interface. Strings are
written in [MessageFormat 2](https://messageformat.unicode.org); add a language or change any
string with `messages`:

```ts
export default defineConfig({
	title: 'My library',
	locales: { en: { label: 'English' }, fr: { label: 'Français' } },
	messages: {
		fr: {
			'toc.title': 'Sur cette page',
			'search.noResults': 'Aucun résultat pour « {$query} »'
		}
	}
});
```

Keys you leave out fall back to English. The full list of keys, with the English text, is in
[`src/i18n/messages.ts`](https://github.com/krowten/svelte-edda/blob/main/src/i18n/messages.ts).
`svelte-edda` refuses to start on an unknown key or a message that is not valid MessageFormat 2.

## AI agents and Context7

`llms.txt` and `llms-full.txt` are written in the default language only, while `sitemap.xml` lists
the translated pages of every language; every page, translated or not, is also served as Markdown
at its URL with `.md`. Context7 indexes English
only, so point it at the default language's folder in `context7.json`:

```json
{ "folders": ["docs/en"] }
```

`svelte-edda check` warns when translations are not kept out.
