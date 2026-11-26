import { defineConfig } from '../../../src/index.ts';

export default defineConfig({
	title: 'Polyglot',
	description: 'Fixture site in three languages.',
	site: 'https://example.dev',
	base: '/poly/',
	ogImage: 'og.png',
	head: (page) => [`<meta name="fixture" content="${page.lang}|${page.slug}|${page.url}" />`],
	locales: {
		en: { label: 'English' },
		ru: { label: 'Русский' },
		fr: { label: 'Français' }
	},
	nav: [
		{ text: { en: 'Guide', ru: 'Руководство' }, link: 'guide/index.md' },
		{ text: 'GitHub', link: 'https://github.com/example/polyglot' }
	],
	sidebar: [
		'index.md',
		{ text: { en: 'Learn', ru: 'Изучение' }, collapsed: true, items: ['guide/index.md'] }
	],
	components: [
		{
			name: 'greeting',
			component: 'components/Greeting.svelte',
			interactive: true,
			description: 'A greeting in the language of the page.'
		}
	],
	messages: {
		fr: { 'toc.title': 'Sur cette page' }
	}
});
