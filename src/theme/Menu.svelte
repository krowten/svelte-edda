<script lang="ts">
	import type { LayoutLink } from './types.ts';

	let { label, items, testid }: { label: string; items: LayoutLink[]; testid: string } = $props();

	const current = $derived(items.find((item) => item.current));
</script>

<!-- A disclosure of plain links: works without JavaScript, and every choice is a real URL. -->
<details class="docs-menu relative" data-testid={testid}>
	<summary
		data-testid="{testid}-toggle"
		class="text-base-600 hover:bg-base-100 hover:text-base-900 dark:text-base-400 dark:hover:bg-base-800 dark:hover:text-base-200 flex h-9 cursor-pointer list-none items-center gap-1 rounded px-2 text-sm"
	>
		<span class="sr-only">{label}:</span>
		<span class="max-w-32 truncate">{current?.title ?? label}</span>
		<svg
			viewBox="0 0 24 24"
			class="size-4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</summary>
	<ul
		class="border-base-200 dark:border-base-800 dark:bg-base-900 absolute right-0 z-40 mt-1 min-w-40 rounded border bg-white py-1 shadow-lg"
	>
		{#each items as item (item.url + item.title)}
			<li>
				<a
					href={item.url}
					lang={item.lang}
					hreflang={item.lang}
					aria-current={item.current ? 'true' : undefined}
					class="block px-3 py-1.5 text-sm whitespace-nowrap {item.current
						? 'text-accent-700 dark:text-accent-500 font-medium'
						: 'text-base-700 hover:bg-base-100 dark:text-base-300 dark:hover:bg-base-800'}"
				>
					{item.title}
				</a>
			</li>
		{/each}
	</ul>
</details>
