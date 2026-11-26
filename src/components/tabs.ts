import type { ResolvedComponent } from '../config.ts';

import { join } from 'node:path';

import { engineSrc } from '../paths.ts';
import { labelledParts } from './labelled.ts';

export const tabs: ResolvedComponent = {
	name: 'tabs',
	component: join(engineSrc, 'components', 'Tabs.svelte'),
	description:
		'Switchable variants of the same content. Start each variant with a bold label line, e.g. **npm**.',
	example: [
		'<!-- tabs -->',
		'**npm**',
		'```sh\nnpm install my-library\n```',
		'**bun**',
		'```sh\nbun add my-library\n```',
		'<!-- /tabs -->'
	].join('\n\n'),
	interactive: true,
	attributes: {
		sync: {
			type: 'string',
			description:
				'Groups with the same key switch together and remember the choice. Defaults to the list of labels.'
		}
	},
	prepare({ attributes, children, toHtml, error }) {
		const panels = labelledParts(children);
		if (!panels) {
			error('content must start with a bold label line, e.g. **npm**');
			return { panels: [], sync: '' };
		}

		if (panels.length === 0)
			error('add at least one variant: a bold label line followed by its content');
		for (const panel of panels) {
			if (panel.nodes.length === 0) error(`variant "${panel.label}" has no content`);
		}
		const labels = panels.map((panel) => panel.label);
		if (new Set(labels).size !== labels.length) error('variant labels must be unique');

		return {
			panels: panels.map((panel) => ({ label: panel.label, html: toHtml(panel.nodes) })),
			sync: typeof attributes.sync === 'string' ? attributes.sync : labels.join('|')
		};
	}
};
