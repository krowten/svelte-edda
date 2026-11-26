import type { Data, Parent, Root, RootContent } from 'mdast';
import type { Position } from 'unist';
import type { VFile } from 'vfile';
import type { ResolvedComponent } from '../config.ts';
import type { AttributeValue } from '../types.ts';

import { reportError, reportWarning } from './report.ts';

export type DocsComponent = {
	type: 'docsComponent';
	name: string;
	attributes: Record<string, AttributeValue>;
	children: RootContent[];
	position?: Position;
	data?: Data;
};

declare module 'mdast' {
	// Interfaces are required here: mdast is extended through declaration merging.
	interface RootContentMap {
		docsComponent: DocsComponent;
	}
	interface BlockContentMap {
		docsComponent: DocsComponent;
	}
}

export type Marker = {
	name: string;
	closing: boolean;
	selfClosing: boolean;
	attributes: Record<string, AttributeValue>;
};

const MARKER = /^<!--\s*(\/?)([a-z][a-z0-9-]*)((?:\s+[a-z][\w-]*(?:="[^"]*")?)*)\s*(\/?)\s*-->$/;
const ATTRIBUTE = /([a-z][\w-]*)(?:="([^"]*)")?/g;

/** Parses `<!-- name a="b" c -->`, `<!-- /name -->` and `<!-- name /-->`. */
export function parseMarker(value: string): Marker | undefined {
	const match = MARKER.exec(value.trim());
	if (!match) return undefined;
	const attributes: Record<string, AttributeValue> = {};
	for (const [, key, attributeValue] of (match[3] ?? '').matchAll(ATTRIBUTE)) {
		attributes[key!] = attributeValue ?? true;
	}
	return { name: match[2]!, closing: match[1] === '/', selfClosing: match[4] === '/', attributes };
}

/** Turns comment marker pairs into `docsComponent` nodes wrapping the Markdown between them. */
export function remarkMarkers(options: { components: Map<string, ResolvedComponent> }) {
	return (tree: Root, file: VFile) => {
		transformChildren(tree, file, options.components);
	};
}

function transformChildren(
	parent: Parent,
	file: VFile,
	components: Map<string, ResolvedComponent>
): void {
	const result: RootContent[] = [];
	const open: DocsComponent[] = [];
	const append = (node: RootContent) => (open.at(-1)?.children ?? result).push(node);

	for (const child of parent.children) {
		const marker = child.type === 'html' ? parseMarker(child.value) : undefined;
		if (!marker) {
			// With `=` it is meant as a marker, not as a comment that begins with a component's name.
			const name =
				child.type === 'html' && /^<!--\s*([a-z][a-z0-9-]*)\s[^>]*=/.exec(child.value)?.[1];
			if (name && components.has(name))
				reportError(
					file,
					`Malformed <!-- ${name} -->: write attributes as name="value", in double quotes`,
					child
				);
			if ('children' in child) transformChildren(child, file, components);
			append(child);
			continue;
		}

		const definition = components.get(marker.name);
		if (!definition) {
			// Plain comments such as `<!-- prettier-ignore -->` look like markers; only closing and
			// self-closing forms are specific enough to call out.
			if (marker.closing)
				reportError(file, `Closing marker for unknown component "${marker.name}"`, child);
			else if (marker.selfClosing) reportWarning(file, `Unknown component "${marker.name}"`, child);
			append(child);
			continue;
		}

		if (marker.closing) {
			const current = open.at(-1);
			if (current?.name !== marker.name) {
				reportError(
					file,
					`Unexpected <!-- /${marker.name} -->: no open <!-- ${marker.name} --> here`,
					child
				);
				continue;
			}
			open.pop();
			append(current);
			continue;
		}

		validateAttributes(definition, marker.attributes, file, child);
		const node: DocsComponent = {
			type: 'docsComponent',
			name: marker.name,
			attributes: marker.attributes,
			children: [],
			position: child.position
		};
		if (marker.selfClosing) append(node);
		else open.push(node);
	}

	while (open.length > 0) {
		const node = open.pop()!;
		reportError(file, `<!-- ${node.name} --> is never closed with <!-- /${node.name} -->`, node);
		// Its content stays ordinary Markdown, so one missing marker gives one error.
		for (const child of node.children) append(child);
	}

	parent.children = result;
}

function validateAttributes(
	definition: ResolvedComponent,
	attributes: Record<string, AttributeValue>,
	file: VFile,
	place: RootContent
): void {
	// The engine sets `lang` itself, so a written one would be silently replaced.
	if ('lang' in attributes)
		reportError(
			file,
			`<!-- ${definition.name} --> gets the page language as \`lang\` by itself; remove the attribute`,
			place
		);
	const declared = definition.attributes;
	if (!declared) return;

	for (const [name, value] of Object.entries(attributes)) {
		if (name === 'lang') continue;
		const spec = declared[name];
		if (!spec) {
			const known = Object.keys(declared);
			const hint = known.length > 0 ? ` Known attributes: ${known.join(', ')}.` : '';
			reportError(
				file,
				`Unknown attribute "${name}" on <!-- ${definition.name} -->.${hint}`,
				place
			);
			continue;
		}
		if (spec.type === 'boolean' && value !== true) {
			reportError(file, `Attribute "${name}" on <!-- ${definition.name} --> takes no value`, place);
		} else if (spec.type !== 'boolean' && value === true) {
			reportError(
				file,
				`Attribute "${name}" on <!-- ${definition.name} --> needs a value: ${name}="…"`,
				place
			);
		} else if (spec.values && typeof value === 'string' && !spec.values.includes(value)) {
			reportError(
				file,
				`Attribute "${name}" on <!-- ${definition.name} --> must be one of: ${spec.values.join(', ')}`,
				place
			);
		}
	}

	for (const [name, spec] of Object.entries(declared)) {
		if (spec.required && !(name in attributes)) {
			reportError(file, `<!-- ${definition.name} --> requires the "${name}" attribute`, place);
		}
	}
}
