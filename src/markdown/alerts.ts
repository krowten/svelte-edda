import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import type { Translate } from '../i18n/translator.ts';

import { visit } from 'unist-util-visit';

import { reportError } from './report.ts';

const ALERT = /^\[!([a-z]+)\][ \t]*(?:\r?\n|$)/i;
const KINDS = ['note', 'tip', 'important', 'warning', 'caution'] as const;

const CLASSES: Record<(typeof KINDS)[number], { box: string; title: string }> = {
	note: {
		box: 'border-sky-600 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40',
		title: 'text-sky-700 dark:text-sky-400'
	},
	tip: {
		box: 'border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-950/40',
		title: 'text-green-700 dark:text-green-400'
	},
	important: {
		box: 'border-violet-600 bg-violet-50 dark:border-violet-500 dark:bg-violet-950/40',
		title: 'text-violet-700 dark:text-violet-400'
	},
	warning: {
		box: 'border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40',
		title: 'text-amber-700 dark:text-amber-400'
	},
	caution: {
		box: 'border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950/40',
		title: 'text-red-700 dark:text-red-400'
	}
};

/** GitHub alerts: `> [!NOTE]` and friends become `<aside data-alert="note">`. */
export function remarkAlerts(options: { t: Translate }) {
	return (tree: Root, file: VFile) => {
		visit(tree, 'blockquote', (node) => {
			const paragraph = node.children[0];
			if (paragraph?.type !== 'paragraph') return;
			const text = paragraph.children[0];
			if (text?.type !== 'text') return;
			const match = ALERT.exec(text.value);
			if (!match) return;

			const kind = KINDS.find((known) => known === match[1]!.toLowerCase());
			if (!kind) {
				// Otherwise it is printed as a plain quote that starts with "[!WARN]".
				reportError(
					file,
					`Unknown alert [!${match[1]}]: use NOTE, TIP, IMPORTANT, WARNING or CAUTION`,
					node
				);
				return;
			}
			text.value = text.value.slice(match[0].length);
			if (!text.value) paragraph.children.shift();
			if (paragraph.children.length === 0) node.children.shift();

			const title = options.t(`alert.${kind}`);
			node.data = {
				hName: 'aside',
				hProperties: {
					className: ['mt-6 mb-6 rounded border-l-4 px-4 py-3 *:last:mb-0', CLASSES[kind].box],
					dataAlert: kind,
					role: 'note'
				}
			};
			node.children.unshift({
				type: 'paragraph',
				data: { hProperties: { className: ['mt-0 mb-1 font-semibold', CLASSES[kind].title] } },
				children: [{ type: 'text', value: title }]
			});
		});
	};
}
