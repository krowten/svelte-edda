import type { ResolvedComponent, ResolvedConfig } from './config.ts';

import { basename, join, relative } from 'node:path';

import { engineRoot, toPosix } from './paths.ts';

/** A marker for the component with its required attributes filled in. */
function exampleOf(component: ResolvedComponent): string {
	if (component.example) return component.example;
	const attributes = Object.entries(component.attributes ?? {})
		.filter(([, attribute]) => attribute.required)
		.map(([name, attribute]) =>
			attribute.type === 'boolean' ? ` ${name}` : ` ${name}="${attribute.values?.[0] ?? '…'}"`
		)
		.join('');
	return `<!-- ${component.name}${attributes} -->\n\nContent in Markdown.\n\n<!-- /${component.name} -->`;
}

function componentSection(component: ResolvedComponent): string {
	const attributes = Object.entries(component.attributes ?? {}).map(([name, attribute]) => {
		const facts = [
			attribute.required ? 'required' : 'optional',
			attribute.type === 'boolean' ? 'no value' : (attribute.values?.join(' | ') ?? 'text')
		];
		return `- \`${name}\` (${facts.join('; ')})${attribute.description ? `: ${attribute.description}` : ''}`;
	});
	return [
		`### ${component.name}`,
		component.description ?? '',
		`\`\`\`\`md\n${exampleOf(component)}\n\`\`\`\``,
		attributes.length > 0 ? `Attributes:\n\n${attributes.join('\n')}` : ''
	]
		.filter(Boolean)
		.join('\n\n');
}

/**
 * How to write this project's documentation, as Markdown: the syntax the engine reads and the
 * components this project defines. Printed by `svelte-edda guide` for people and coding agents
 * who have never seen the engine.
 */
export function guide(config: ResolvedConfig): string {
	const docs = toPosix(relative(config.root, config.docsDir)) || '.';
	const fallback = config.locales[0];
	const pages = fallback ? `${docs}/${fallback.key}` : docs;
	const configName = config.configFile ? `\`${basename(config.configFile)}\`` : 'the config';

	const sections = [
		`# Writing the documentation of ${config.title}`,
		`The documentation is built by svelte-edda from the Markdown files in \`${docs}/\`. Edit those files, then run \`svelte-edda check\`: it reports wrong markers, attributes, alerts and broken links with file and line, and must end with "No errors found."`,

		'## Pages',
		[
			`- Every \`.md\` file is a page: \`${pages}/guide/install.md\` is served at \`/guide/install/\`, and \`index.md\` is the page of its folder.`,
			config.sidebar
				? `- The sidebar is listed in \`sidebar\` of ${configName}: add a new page there, in its group, or \`check\` warns about it; a group with \`dir\` takes every page of its folder by itself. Name files plainly, without numbers.`
				: `- A numeric prefix orders the sidebar and is dropped from the URL: \`10-guide/20-install.md\`. Follow the numbering that is already there. To name sections and order pages without numbers, list them in a \`sidebar\` option of ${configName} instead: plain file paths, and groups \`{ text, items }\` or \`{ text, dir }\` (every page of a folder), \`collapsed: true\` to start folded.`,
			`- ${config.nav.length > 0 ? `The header links are \`nav\` of ${configName}` : `Header links go into a \`nav\` option of ${configName}`}: \`{ text, link }\`, where \`link\` is a page file or a URL.`,
			fallback
				? `- A \`text\` in \`nav\` or \`sidebar\` can be one per language: \`{ ${config.locales.map((locale) => `${locale.key}: '…'`).join(', ')} }\`; \`check\` warns about a missing one.`
				: '',
			'- The first `# Heading` is the page title. Frontmatter is optional: `title` (browser title), `sidebar` (name in the sidebar, or `false` to leave the page out), `description` (search snippet; the first paragraph when missing), `order`, `slug` (URL path), `layout: landing` (full width, no sidebar), `editUrl` (where "Edit this page" leads).',
			...config.generate.map(
				(generator) =>
					`- \`${toPosix(relative(config.root, generator.dir))}/\` is generated, never edit it: ${generator.description} ${generator.commit ? '`svelte-edda check` reports a page that differs from what the generator writes; run `svelte-edda generate` after changing the source and commit the result.' : 'It is not committed and is written again by every `dev`, `build` and `check`.'}`
			),
			fallback
				? `- One folder per language: ${config.locales.map((locale) => `\`${docs}/${locale.key}/\``).join(', ')}. The same path in each folder is the same page; a page missing from a language is shown from \`${pages}/\`, so write there first.`
				: '',
			config.versions.length > 0
				? `- Older versions (${config.versions.map((version) => version.label).join(', ')}) are built from git tags. Only the files in the working tree can be edited.`
				: ''
		]
			.filter(Boolean)
			.join('\n'),

		'## Markdown',
		[
			'GitHub-flavoured Markdown: tables, task lists, footnotes, fenced code blocks with a language.',
			'',
			`- Link to other pages by the relative path of their file, never by URL: \`[Install](./${config.sidebar ? '' : '20-'}install.md#usage)\`. The same for images: \`![Diagram](./diagram.svg)\`. A \`#fragment\` must be the id of a heading: its text in lower case with hyphens.`,
			'- Alerts are GitHub alerts, a quote that starts with the type on its own line. The types are NOTE, TIP, IMPORTANT, WARNING and CAUTION:',
			'',
			'  ```md',
			'  > [!WARNING]',
			'  > Back up the database first.',
			'  ```',
			'',
			'- A `svelte` code block marked `live` is shown as a working component above its source:',
			'',
			'  ````md',
			'  ```svelte live',
			'  <script>',
			'  	let count = $state(0);',
			'  </script>',
			'',
			'  <button onclick={() => count++}>Clicked {count}</button>',
			'  ```',
			'  ````'
		].join('\n'),

		'## Components',
		'A component is a pair of HTML comments, each on its own line with a blank line around it, and ordinary Markdown between them. Attributes are `name="value"` or a bare `name`. A component without content is written `<!-- name /-->`. These are all the components of this project:',
		...[...config.components.values()].map(componentSection),
		`A new component is a Svelte file registered in \`components\` of ${configName}; see \`custom-components.md\` in the documentation below. Besides its attributes it gets \`lang\`, the language of the page, for the words in its own markup.`,

		'## Not supported',
		'MDX and JSX tags (`<Tabs>`), container directives (`:::tip`) and template tags (`{% tabs %}`) are not read; `svelte-edda check` reports them. Use the alerts and components above.',

		'## More',
		`The full documentation of svelte-edda is in \`${toPosix(relative(config.root, join(engineRoot, 'docs')))}/\`.`
	];
	return `${sections.join('\n\n')}\n`;
}
