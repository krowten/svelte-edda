import type { Element, ElementContent, Parents, Root } from 'hast';
import type { State } from 'mdast-util-to-hast';
import type { VFile } from 'vfile';
import type { ResolvedComponent } from '../config.ts';
import type { AttributeValue } from '../types.ts';
import type { DocsComponent } from './markers.ts';

import { toHtml } from 'hast-util-to-html';

import { reportError } from './report.ts';

declare module 'hast' {
	// Interface required: hast element data is extended through declaration merging.
	interface ElementData {
		docsComponent?: { name: string; attributes: Record<string, AttributeValue> };
	}
}

export type ComponentInstance =
	| {
			kind: 'component';
			definition: ResolvedComponent;
			props: Record<string, unknown>;
			childrenHtml?: string;
	  }
	| { kind: 'demo'; source: string; codeHtml: string };

/** Renders one component to HTML. `check` runs without one: markers are validated, not rendered. */
export type RenderComponent = (instance: ComponentInstance) => Promise<string>;

/** remark-rehype handler: keeps the component as a placeholder element around its converted content. */
export function docsComponentHandler(state: State, node: DocsComponent): Element {
	const element: Element = {
		type: 'element',
		tagName: 'docs-component',
		properties: {},
		data: { docsComponent: { name: node.name, attributes: node.attributes } },
		children: state.all(node as never)
	};
	state.patch(node as never, element);
	return element;
}

export const html = (nodes: ElementContent[]) => toHtml(nodes, { allowDangerousHtml: true });

const isBlank = (nodes: ElementContent[]) =>
	nodes.every((node) => (node.type === 'text' && !node.value.trim()) || node.type === 'comment');

/** Renders components innermost first, so a component's content already contains rendered children. */
export function rehypeComponents(options: {
	components: Map<string, ResolvedComponent>;
	render?: RenderComponent;
	/** Language of the page, passed to every component as `lang`. */
	lang: string;
}) {
	const { components, render, lang } = options;

	const instanceOf = (element: Element, file: VFile): ComponentInstance | undefined => {
		if (element.data?.docsDemo !== undefined) {
			return { kind: 'demo', source: element.data.docsDemo, codeHtml: html(element.children) };
		}
		const info = element.data?.docsComponent;
		const definition = info && components.get(info.name);
		if (!info || !definition) return undefined;

		// Shiki leaves a fragment in place of a code block; a component gets the block itself.
		const children = (element.children as (ElementContent | Root)[]).flatMap((node) =>
			node.type === 'root' ? (node.children as ElementContent[]) : [node]
		);
		let props: Record<string, unknown>;
		try {
			props = definition.prepare
				? definition.prepare({
						attributes: info.attributes,
						lang,
						children,
						toHtml: html,
						error: (message) => reportError(file, `<!-- ${info.name} -->: ${message}`, element)
					})
				: { ...info.attributes };
		} catch (error) {
			reportError(
				file,
				`<!-- ${info.name} -->: ${error instanceof Error ? error.message : String(error)}`,
				element
			);
			return undefined;
		}

		let childrenHtml: string | undefined;
		if (typeof props.children === 'string') {
			childrenHtml = props.children;
			delete props.children;
		} else if (!definition.prepare && !isBlank(children)) {
			childrenHtml = html(children);
		}
		return { kind: 'component', definition, props: { ...props, lang }, childrenHtml };
	};

	const walk = async (parent: Parents, file: VFile): Promise<void> => {
		for (const [index, child] of parent.children.entries()) {
			if (child.type !== 'element') continue;
			await walk(child, file);
			if (child.tagName !== 'docs-component') continue;
			const instance = instanceOf(child, file);
			let value = '';
			try {
				if (instance && render) value = await render(instance);
			} catch (error) {
				// A component that throws while rendering names its place in the Markdown.
				const name = child.data?.docsComponent?.name;
				reportError(
					file,
					`${name ? `<!-- ${name} -->` : 'Live demo'} failed to render: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
					child
				);
			}
			parent.children[index] = { type: 'raw', value };
		}
	};

	return (tree: Root, file: VFile) => walk(tree, file);
}
