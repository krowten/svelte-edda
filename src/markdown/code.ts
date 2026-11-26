import type { RehypeShikiCoreOptions } from '@shikijs/rehype/core';
import type { Element, Root } from 'hast';
import type { Highlighter } from 'shiki';
import type { VFile } from 'vfile';

import { toString } from 'hast-util-to-string';
import { createHighlighter } from 'shiki';
import { compile } from 'svelte/compiler';
import { SKIP, visit } from 'unist-util-visit';

import { reportError } from './report.ts';

declare module 'hast' {
	// Interface required: hast element data is extended through declaration merging.
	interface ElementData {
		/** Source of a ```svelte live``` block. */
		docsDemo?: string;
	}
}

// Both pass WCAG AA contrast on the default code backgrounds (`base-50` and `base-800`).
const LIGHT = 'github-light-high-contrast';
const DARK = 'github-dark-default';

let highlighter: Promise<Highlighter> | undefined;

/** One highlighter per process; languages load on first use. */
export function getHighlighter(): Promise<Highlighter> {
	return (highlighter ??= createHighlighter({
		themes: [LIGHT, DARK],
		langs: []
	}));
}

export const shikiOptions: RehypeShikiCoreOptions = {
	themes: { light: LIGHT, dark: DARK },
	defaultColor: false,
	lazy: true,
	defaultLanguage: 'text',
	fallbackLanguage: 'text'
};

function codeOf(pre: Element): Element | undefined {
	const code = pre.children.find((child) => child.type === 'element' && child.tagName === 'code');
	return code?.type === 'element' ? code : undefined;
}

type CompileError = Error & { start?: { line: number; column: number } };

/**
 * Marks ```svelte live``` blocks as demos. Runs before highlighting, which drops the meta.
 * A demo that does not compile is reported at its line in the Markdown and stays a code block.
 */
export function rehypeLiveDemos() {
	return (tree: Root, file: VFile) => {
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName !== 'pre' || !parent || index === undefined) return;
			const code = codeOf(node);
			const classes = code?.properties.className;
			if (!code || !Array.isArray(classes) || !classes.includes('language-svelte')) return;
			if (!/(^|\s)live(\s|$)/.test(code.data?.meta ?? '')) return;

			const source = toString(code);
			try {
				compile(source, { generate: false, filename: 'Demo.svelte' });
			} catch (error) {
				const { message, start } = error as CompileError;
				// The block's first line is its opening fence; the code starts on the next one.
				const fence = node.position?.start;
				const point = fence && {
					line: fence.line + (start?.line ?? 1),
					column: fence.column + (start?.column ?? 0)
				};
				reportError(
					file,
					`Live demo does not compile: ${message.split('\n')[0]}`,
					point && { type: 'element', position: { start: point, end: point } }
				);
				return;
			}

			parent.children[index] = {
				type: 'element',
				tagName: 'docs-component',
				properties: {},
				data: { docsDemo: source },
				children: [node],
				position: node.position
			};
			return SKIP;
		});
	};
}

const FRAME =
	'mt-0 mb-0 overflow-x-auto rounded border border-base-200 bg-base-50 p-4 font-mono text-sm leading-relaxed in-data-demo:rounded-none in-data-demo:border-0 in-data-demo:border-t dark:border-base-800 dark:bg-base-800';
// Shiki emits the colors of both themes as variables on the block and on every token.
const TOKENS = '**:text-(--shiki-light) dark:**:text-(--shiki-dark)';
const COPY =
	'absolute top-2 right-2 rounded border border-base-200 bg-white px-2 py-1 font-sans text-xs text-base-600 opacity-0 transition-opacity group-hover/code:opacity-100 focus-visible:opacity-100 data-copied:opacity-100 pointer-coarse:opacity-100 dark:border-base-700 dark:bg-base-900 dark:text-base-300';

/** Wraps highlighted blocks with a copy button. `docs-code` is a hook, it carries no styles. */
export function rehypeCodeBlocks(options: { copy: string; copyLabel: string }) {
	return (tree: Root) => {
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName !== 'pre' || !parent || index === undefined) return;
			node.properties.class = `${String(node.properties.class)} ${FRAME} ${TOKENS}`;
			parent.children[index] = {
				type: 'element',
				tagName: 'div',
				properties: { className: ['docs-code', 'group/code relative mt-6 mb-6 in-data-demo:my-0'] },
				children: [
					{
						type: 'element',
						tagName: 'button',
						properties: {
							type: 'button',
							className: [COPY],
							dataCopy: true,
							dataPagefindIgnore: true,
							ariaLabel: options.copyLabel
						},
						children: [{ type: 'text', value: options.copy }]
					},
					node
				]
			};
			return [SKIP, index + 1];
		});
	};
}
