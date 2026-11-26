<script lang="ts">
	import type { Translate } from '../i18n/translator.ts';
	import type { SidebarItem } from '../pages.ts';

	import Sidebar from './Sidebar.svelte';

	let {
		items,
		current,
		t,
		path = '',
		id,
		hidden = false
	}: {
		items: SidebarItem[];
		current: string;
		t: Translate;
		/** Titles of the enclosing groups: the key under which a reader's choice is remembered. */
		path?: string;
		id?: string;
		hidden?: boolean;
	} = $props();

	const uid = $props.id();
	const nested = $derived(path !== '');

	const link = (url: string) =>
		url === current
			? 'font-medium text-accent-700 dark:text-accent-500'
			: 'text-base-600 hover:bg-base-100 hover:text-base-900 dark:text-base-400 dark:hover:bg-base-800 dark:hover:text-base-200';

	const holds = (item: SidebarItem): boolean =>
		item.url === current || (item.type === 'group' && item.items.some(holds));
</script>

<!-- Without JavaScript every group is open and its toggle does nothing. -->
{#snippet chevron()}
	<svg
		viewBox="0 0 24 24"
		class="hidden size-4 shrink-0 transition-transform group-aria-expanded:rotate-90 in-[.js]:block"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
{/snippet}

<ul
	{id}
	{hidden}
	class={nested ? 'border-base-200 dark:border-base-800 mt-1 ml-3 border-l pl-2' : 'space-y-0.5'}
>
	{#each items as item, index (item.url ?? item.title)}
		<li>
			{#if item.type === 'page'}
				<a
					href={item.url}
					aria-current={item.url === current ? 'page' : undefined}
					class="block rounded px-2 py-1.5 text-sm {link(item.url)}"
				>
					{item.title}
				</a>
			{:else}
				{const open = !item.collapsed || holds(item)}
				{const list = `${uid}-${index}`}
				{const key = `${path}/${item.title}`}
				<div class="mt-6 flex items-center gap-1">
					{#if item.url}
						<a
							href={item.url}
							aria-current={item.url === current ? 'page' : undefined}
							class="block flex-1 rounded px-2 py-1.5 text-sm font-semibold {item.url === current
								? 'text-accent-700 dark:text-accent-500'
								: 'text-base-900 hover:bg-base-100 dark:text-base-200 dark:hover:bg-base-800'}"
						>
							{item.title}
						</a>
						<button
							type="button"
							data-sidebar-group-toggle
							data-key={key}
							aria-expanded={open}
							aria-controls={list}
							aria-label={t('nav.toggleGroup', { group: item.title })}
							class="group text-base-500 hover:bg-base-100 hover:text-base-900 dark:text-base-400 dark:hover:bg-base-800 dark:hover:text-base-200 inline-flex size-8 items-center justify-center rounded"
						>
							{@render chevron()}
						</button>
					{:else}
						<button
							type="button"
							data-sidebar-group-toggle
							data-key={key}
							aria-expanded={open}
							aria-controls={list}
							class="group text-base-900 hover:bg-base-100 dark:text-base-200 dark:hover:bg-base-800 flex flex-1 items-center justify-between rounded px-2 py-1.5 text-left text-sm font-semibold"
						>
							{item.title}
							{@render chevron()}
						</button>
					{/if}
				</div>
				<Sidebar items={item.items} {current} {t} path={key} id={list} hidden={!open} />
			{/if}
		</li>
	{/each}
</ul>
