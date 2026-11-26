import type { MessageKey, Messages } from './messages.ts';

import { MessageFormat } from 'messageformat';

import { builtInMessages, en } from './messages.ts';

export type Translate = (key: MessageKey, values?: Record<string, unknown>) => string;

/** User additions and overrides, by language: `{ fr: { 'toc.title': 'Sur cette page' } }`. */
export type MessageOverrides = Record<string, Partial<Messages>>;

const primary = (lang: string) => lang.toLowerCase().split('-')[0] ?? lang;

/**
 * The interface language for a content language: the language itself when built-in or user
 * messages exist for it (matched by its primary subtag, so `de-AT` uses `de`), English otherwise.
 */
export function interfaceLanguage(lang: string, overrides: MessageOverrides = {}): string {
	const code = primary(lang);
	if (builtInMessages[code]) return code;
	const custom = Object.keys(overrides).find((key) => primary(key) === code);
	return custom ? primary(custom) : 'en';
}

function messagesFor(lang: string, overrides: MessageOverrides): Messages {
	const custom = Object.entries(overrides).find(([key]) => primary(key) === lang)?.[1];
	return { ...en, ...builtInMessages[lang], ...custom };
}

/** Throws on a message that is not valid MessageFormat 2, naming the language and key. */
export function validateMessages(overrides: MessageOverrides): void {
	for (const [lang, messages] of Object.entries(overrides)) {
		for (const [key, source] of Object.entries(messages)) {
			if (!(key in en))
				throw new Error(`svelte-edda: unknown interface message "${key}" (${lang})`);
			try {
				new MessageFormat(lang, source as string);
			} catch (error) {
				throw new Error(
					`svelte-edda: message "${key}" (${lang}) is not valid MessageFormat 2: ${(error as Error).message}`,
					{ cause: error }
				);
			}
		}
	}
}

export function createTranslator(lang: string, overrides: MessageOverrides = {}): Translate {
	const language = interfaceLanguage(lang, overrides);
	const messages = messagesFor(language, overrides);
	const compiled = new Map<MessageKey, MessageFormat>();
	return (key, values) => {
		let format = compiled.get(key);
		if (!format) {
			// The page sets `dir`, so placeholders need no bidi isolation marks.
			format = new MessageFormat(language, messages[key], { bidiIsolation: 'none' });
			compiled.set(key, format);
		}
		return format.format(values);
	};
}
