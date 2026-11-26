import type { Element, ElementContent } from 'hast';

import { toString } from 'hast-util-to-string';

/** A bold line and the content up to the next one. */
export type Labelled = { label: string; title: ElementContent[]; nodes: ElementContent[] };

const isBlank = (node: ElementContent) =>
	(node.type === 'text' && !node.value.trim()) || node.type === 'comment';

/** A paragraph that holds nothing but bold text: `**npm**`. */
function boldLine(node: ElementContent): Element | undefined {
	if (node.type !== 'element' || node.tagName !== 'p') return undefined;
	const content = node.children.filter((child) => !isBlank(child));
	const strong = content[0];
	if (content.length !== 1 || strong?.type !== 'element' || strong.tagName !== 'strong')
		return undefined;
	return toString(strong).trim() ? strong : undefined;
}

/** Splits content at its bold lines; `undefined` when something stands before the first one. */
export function labelledParts(children: ElementContent[]): Labelled[] | undefined {
	const parts: Labelled[] = [];
	for (const node of children) {
		if (isBlank(node)) continue;
		const strong = boldLine(node);
		if (strong) {
			parts.push({ label: toString(strong).trim(), title: strong.children, nodes: [] });
			continue;
		}
		const current = parts.at(-1);
		if (!current) return undefined;
		current.nodes.push(node);
	}
	return parts;
}
