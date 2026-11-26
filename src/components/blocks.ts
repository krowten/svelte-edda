import type { Element, ElementContent } from 'hast';
import type { ResolvedComponent } from '../config.ts';

import { join } from 'node:path';

import { engineSrc } from '../paths.ts';
import { labelledParts } from './labelled.ts';

const file = (name: string) => join(engineSrc, 'components', name);

export const cards: ResolvedComponent = {
	name: 'cards',
	component: file('Cards.svelte'),
	description:
		'A grid of cards. Start each card with a bold title line; a title that is a link makes the whole card clickable.',
	example: [
		'<!-- cards -->',
		'**Typed**',
		'The schema is the type.',
		'**Small**',
		'No dependencies.',
		'<!-- /cards -->'
	].join('\n\n'),
	attributes: {},
	prepare({ children, toHtml, error }) {
		const parts = labelledParts(children);
		if (!parts?.length) error('start each card with a bold title line, e.g. **Fast**');
		return {
			cards: (parts ?? []).map((part) => ({
				title: toHtml(part.title),
				html: toHtml(part.nodes)
			}))
		};
	}
};

// A number in a circle, and a line down to the next one.
const STEP = [
	'relative mt-0 mb-0 pb-8 pl-12 last:pb-0 *:first:mt-0',
	'before:absolute before:top-0 before:left-0 before:flex before:size-8 before:items-center before:justify-center before:rounded-full before:border before:border-base-300 before:text-sm before:font-medium before:text-base-700 before:content-[counter(list-item)] dark:before:border-base-700 dark:before:text-base-200',
	'not-last:after:absolute not-last:after:top-10 not-last:after:bottom-2 not-last:after:left-4 not-last:after:w-px not-last:after:bg-base-300 dark:not-last:after:bg-base-700'
].join(' ');

export const steps: ResolvedComponent = {
	name: 'steps',
	component: file('Steps.svelte'),
	description: 'A numbered list shown as steps with a line through their numbers.',
	example: [
		'<!-- steps -->',
		'1. Install the package.\n2. Add the plugin.\n3. Start the server.',
		'<!-- /steps -->'
	].join('\n\n'),
	attributes: {},
	prepare({ children, toHtml, error }) {
		const elements = children.filter((node) => node.type === 'element');
		if (elements.length !== 1 || elements[0]!.tagName !== 'ol')
			error('put one numbered list inside, and nothing else');
		for (const item of elements[0]?.children ?? []) {
			if (item.type === 'element' && item.tagName === 'li') item.properties.className = [STEP];
		}
		return { html: toHtml(elements) };
	}
};

const isSpace = (node: ElementContent) => node.type === 'text' && !node.value.trim();
const isComment = (node: ElementContent) =>
	node.type === 'raw' && /^<!--(?:(?!-->)[\s\S])*-->$/.test(node.value.trim());

/** A paragraph that holds nothing but the given elements. */
const isParagraphOf = (node: ElementContent, tag: string): node is Element =>
	node.type === 'element' &&
	node.tagName === 'p' &&
	node.children.every(
		(child) => isSpace(child) || (child.type === 'element' && child.tagName === tag)
	);

/** Something to look at: a code block, an image, or a component, which is rendered by now. */
const isPicture = (node: ElementContent) =>
	node.type === 'raw' ||
	(node.type === 'element' && [node.properties.className].flat().includes('docs-code')) ||
	isParagraphOf(node, 'img');

const ACTION = 'rounded border px-5 py-2 text-base font-medium no-underline';
const FIRST_ACTION = `${ACTION} border-accent-700 bg-accent-700 text-white hover:bg-accent-800`;
const OTHER_ACTION = `${ACTION} border-base-300 text-base-900 hover:border-accent-700 dark:border-base-700 dark:text-base-200 dark:hover:border-accent-500`;

const withClass = (node: Element, className: string): Element => ({
	...node,
	properties: { ...node.properties, className: [className] }
});

/** A paragraph of nothing but links, as a row of buttons. */
const actions = (paragraph: Element): Element => {
	const links = paragraph.children.filter((child) => child.type === 'element');
	return withClass(
		{
			...paragraph,
			children: links.map((link, index) =>
				withClass(link, index === 0 ? FIRST_ACTION : OTHER_ACTION)
			)
		},
		'mt-8 flex flex-wrap gap-3'
	);
};

export const hero: ResolvedComponent = {
	name: 'hero',
	component: file('Hero.svelte'),
	description:
		'The opening of a landing page: a title, a few words, and a paragraph of nothing but links, shown as buttons. A code block, image, tabs or live demo at the end stands beside them.',
	example: [
		'<!-- hero -->',
		'# My library',
		'What it does, in one sentence.',
		'```ts\nimport { start } from "my-library";\n```',
		'<!-- /hero -->'
	].join('\n\n'),
	attributes: {},
	prepare({ children, toHtml }) {
		const content = children
			.filter((node) => !isSpace(node) && !isComment(node))
			.map((node) => (isParagraphOf(node, 'a') ? actions(node) : node));
		const last = content.at(-1);
		const aside = content.length > 1 && last && isPicture(last) ? content.pop() : undefined;
		return { html: toHtml(content), aside: aside && toHtml([aside]) };
	}
};
