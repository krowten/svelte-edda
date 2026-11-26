import { defineConfig } from './src/index.ts';

export default defineConfig({
	title: 'svelte-edda',
	description:
		'A static documentation site generator for Markdown, built on Svelte 5 and Vite, with live demos, search, translations and llms.txt for AI agents.',
	// `dist/` holds the bundled CLI.
	outDir: 'dist-docs',
	base: '/svelte-edda/',
	site: 'https://krowten.github.io',
	repository: 'https://github.com/krowten/svelte-edda',
	nav: [
		{ text: 'Guide', link: 'getting-started.md' },
		{ text: 'Reference', link: 'configuration.md' }
	],
	sidebar: [
		{ text: 'Introduction', items: ['index.md', 'getting-started.md', 'docs-as-code.md'] },
		{
			text: 'Comparison',
			collapsed: true,
			items: [
				'comparison/index.md',
				'comparison/docusaurus.md',
				'comparison/vitepress.md',
				'comparison/starlight.md',
				'comparison/mkdocs.md',
				'comparison/gitbook-mintlify.md'
			]
		},
		{
			text: 'Writing',
			items: [
				'writing/index.md',
				'writing/formatting.md',
				'writing/tabs.md',
				'writing/blocks.md',
				'writing/live-demos.md'
			]
		},
		{
			text: 'Customizing',
			items: [
				'custom-components.md',
				'generated-pages.md',
				'theming.md',
				'languages.md',
				'versions.md'
			]
		},
		{ text: 'Reference', items: ['configuration.md', 'deployment.md', 'ai-agents.md'] }
	]
});
