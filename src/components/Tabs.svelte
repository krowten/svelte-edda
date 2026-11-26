<script lang="ts">
	import { getSelected, restore, select } from './tabs-state.svelte.ts';

	type Panel = { label: string; html: string };

	let { panels, sync }: { panels: Panel[]; sync: string } = $props();

	const id = $props.id();
	const active = $derived(
		Math.max(
			0,
			panels.findIndex((panel) => panel.label === getSelected(sync))
		)
	);
	const tabs: HTMLButtonElement[] = $state([]);

	$effect(() => restore(sync));

	function activate(index: number, focus = false) {
		const panel = panels[index];
		if (!panel) return;
		select(sync, panel.label);
		if (focus) tabs[index]?.focus();
	}

	function onkeydown(event: KeyboardEvent, index: number) {
		const last = panels.length - 1;
		const next = {
			ArrowRight: index === last ? 0 : index + 1,
			ArrowLeft: index === 0 ? last : index - 1,
			Home: 0,
			End: last
		}[event.key];
		if (next === undefined) return;
		event.preventDefault();
		activate(next, true);
	}
</script>

<div class="my-6" data-testid="tabs">
	<div
		role="tablist"
		data-pagefind-ignore
		class="not-prose border-base-200 dark:border-base-800 hidden gap-1 overflow-x-auto overflow-y-hidden border-b in-[.js]:flex"
	>
		{#each panels as panel, index (panel.label)}
			<button
				bind:this={tabs[index]}
				type="button"
				role="tab"
				id="{id}-tab-{index}"
				aria-controls="{id}-panel-{index}"
				aria-selected={index === active}
				tabindex={index === active ? 0 : -1}
				class="border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors
          {index === active
					? 'border-accent-700 text-accent-700 dark:border-accent-500 dark:text-accent-500'
					: 'text-base-600 hover:text-base-900 dark:text-base-400 dark:hover:text-base-200 border-transparent'}"
				onclick={() => activate(index)}
				onkeydown={(event) => onkeydown(event, index)}
			>
				{panel.label}
			</button>
		{/each}
	</div>
	{#each panels as panel, index (panel.label)}
		<div
			role="tabpanel"
			id="{id}-panel-{index}"
			aria-labelledby="{id}-tab-{index}"
			hidden={index !== active}
			data-tab-panel
			class="[&>.docs-code:first-of-type]:mt-3"
		>
			<!-- Without JavaScript every variant is shown with its label. -->
			<p class="font-semibold in-[.js]:hidden" data-pagefind-ignore>{panel.label}</p>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- documentation is trusted input, see SECURITY.md -->
			{@html panel.html}
		</div>
	{/each}
</div>
