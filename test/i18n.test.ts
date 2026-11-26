import { describe, expect, test } from 'bun:test';

import { resolveConfig } from '../src/config.ts';
import { builtInMessages, en } from '../src/i18n/messages.ts';
import { createTranslator, interfaceLanguage, validateMessages } from '../src/i18n/translator.ts';

const keys = Object.keys(en).sort();

describe('built-in interface messages', () => {
	test.each(Object.keys(builtInMessages))('%s has exactly the English keys', (lang) => {
		expect(Object.keys(builtInMessages[lang]!).sort()).toEqual(keys);
	});

	test.each(Object.keys(builtInMessages))('%s compiles as MessageFormat 2', (lang) => {
		const t = createTranslator(lang);
		for (const key of keys) {
			const text = t(key as keyof typeof en, {
				query: 'q',
				language: 'L',
				version: 'V',
				date: 'D',
				group: 'G'
			});
			expect(text).not.toBe('');
			// A variable this test does not pass is printed as its placeholder.
			expect(text).not.toContain('{$');
		}
	});
});

describe('interface language', () => {
	test('matches the primary subtag and falls back to English', () => {
		expect(interfaceLanguage('ru')).toBe('ru');
		expect(interfaceLanguage('de-AT')).toBe('de');
		expect(interfaceLanguage('pt-BR')).toBe('en');
		expect(interfaceLanguage('fr', { fr: { 'toc.title': 'Sur cette page' } })).toBe('fr');
	});

	test('formats placeholders without bidi isolation marks', () => {
		expect(createTranslator('ru')('version.archived', { version: '1.x' })).toBe(
			'Это документация к версии 1.x.'
		);
		expect(createTranslator('de')('search.noResults', { query: 'abc' })).toBe(
			'Keine Ergebnisse für „abc“'
		);
	});

	test('user messages override and fill in from English', () => {
		const t = createTranslator('fr', { fr: { 'toc.title': 'Sur cette page' } });
		expect(t('toc.title')).toBe('Sur cette page');
		expect(t('page.next')).toBe('Next');
		expect(createTranslator('en', { en: { 'page.next': 'Onward' } })('page.next')).toBe('Onward');
	});
});

describe('message validation', () => {
	test('rejects unknown keys and invalid syntax', () => {
		expect(() => validateMessages({ fr: { 'nope.key': 'x' } as never })).toThrow(
			'unknown interface message "nope.key" (fr)'
		);
		expect(() => validateMessages({ fr: { 'toc.title': 'Broken {$' } })).toThrow(
			'is not valid MessageFormat 2'
		);
	});
});

describe('config', () => {
	const root = '/tmp/project';
	const locales = { en: { label: 'English' }, ru: { label: 'Русский' } };

	test('puts the default locale first', () => {
		const config = resolveConfig(root, { title: 'T', locales, defaultLocale: 'ru' });
		expect(config.locales.map((locale) => [locale.key, locale.isDefault])).toEqual([
			['ru', true],
			['en', false]
		]);
	});

	test('rejects a default locale that is not configured and the reserved key "v"', () => {
		expect(() => resolveConfig(root, { title: 'T', locales, defaultLocale: 'de' })).toThrow(
			'defaultLocale "de" is not one of the locales'
		);
		expect(() => resolveConfig(root, { title: 'T', locales: { v: { label: 'V' } } })).toThrow(
			'locale key "v"'
		);
	});

	test('derives version slugs and rejects duplicates', () => {
		const config = resolveConfig(root, {
			title: 'T',
			versions: [{ tag: 'v2.0.0' }, { tag: 'v1.4.2', label: '1.x' }]
		});
		expect(config.versions).toEqual([
			{ tag: 'v2.0.0', label: 'v2.0.0', slug: '2.0.0' },
			{ tag: 'v1.4.2', label: '1.x', slug: '1.x' }
		]);
		expect(() =>
			resolveConfig(root, {
				title: 'T',
				versions: [
					{ tag: 'a', slug: 'x' },
					{ tag: 'b', slug: 'x' }
				]
			})
		).toThrow('version slugs must be unique');
	});
});
