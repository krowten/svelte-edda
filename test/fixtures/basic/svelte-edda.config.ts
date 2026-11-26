import { defineComponent, defineConfig } from '../../../src/index.ts';

export default defineConfig({
	title: 'Fixture',
	description: 'Fixture site for engine tests.',
	base: '/fixture/',
	repository: 'https://github.com/example/fixture',
	css: 'theme.css',
	components: [
		defineComponent({
			name: 'badge',
			component: 'components/Badge.svelte',
			attributes: { tone: { type: 'string', values: ['info', 'new'], required: true } }
		}),
		defineComponent({
			name: 'counter',
			component: 'components/Counter.svelte',
			description: 'A button that counts its clicks.',
			example: '<!-- counter /-->',
			interactive: true
		})
	]
});
