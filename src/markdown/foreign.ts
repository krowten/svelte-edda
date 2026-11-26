import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import type { ResolvedComponent } from '../config.ts';

import { visit } from 'unist-util-visit';

import { reportError } from './report.ts';

const ALERTS = new Set(['note', 'tip', 'info', 'important', 'warning', 'caution', 'danger']);
const TABS = new Set(['tabs', 'tab', 'tabitem', 'codegroup', 'code-group', 'codetabs']);

// `:::tip`, `::: tabs` at the start of a line; `{% tabs %}`; `<Tabs>`, `<HStack gap="2">`.
// A tag all in capitals is left alone: it may be plain HTML (`<BR>`) or a type parameter (`<T>`).
const CONTAINER = /(?:^|\n)[ \t]*:::+[ \t]*([a-z][\w-]*)/i;
const TAG = /(?<!\\)\{%-?\s*(?:end)?([a-z][\w-]*)/i;
const JSX = /<([A-Z][A-Z0-9]*[a-z][A-Za-z0-9]*)[\s/>]/;

/**
 * Component syntax of other documentation tools (MDX, container directives, template tags) is
 * ordinary text here and would be printed as it is. Authors used to those tools, people and
 * language models alike, get an error that says what to write instead.
 */
export function remarkForeignSyntax(options: { components: Map<string, ResolvedComponent> }) {
	const instead = (name: string) => {
		const key = name.toLowerCase();
		if (ALERTS.has(key)) return 'write an alert, > [!NOTE] (or TIP, IMPORTANT, WARNING, CAUTION)';
		if (TABS.has(key)) {
			return 'write <!-- tabs --> … <!-- /tabs --> with a bold label line such as **npm** before each variant';
		}
		if (options.components.has(key)) return `write <!-- ${key} --> … <!-- /${key} -->`;
		return 'components are comment markers such as <!-- tabs --> … <!-- /tabs -->, listed by `svelte-edda guide`';
	};

	return (tree: Root, file: VFile) => {
		const source = String(file.value);
		visit(tree, (node) => {
			if (node.type !== 'text' && node.type !== 'html') return;
			// The source, not the parsed value: a backslash escape must still read as an escape.
			const raw = source.slice(node.position?.start.offset, node.position?.end.offset);
			let name: string | undefined;
			let shown = '';
			if (node.type === 'html') {
				name = raw.startsWith('<!--') ? undefined : JSX.exec(raw)?.[1];
				shown = `<${name}>`;
			} else if ((name = CONTAINER.exec(raw)?.[1])) {
				shown = `:::${name}`;
			} else if ((name = TAG.exec(raw)?.[1])) {
				shown = `{% ${name} %}`;
			}
			if (!name) return;
			reportError(
				file,
				`${shown} is not read as a component: ${instead(name)}. To show it as text, put it in a code span.`,
				node
			);
		});
	};
}
