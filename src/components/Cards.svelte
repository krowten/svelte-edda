<script lang="ts">
	let { cards }: { cards: { title: string; html: string }[] } = $props();
</script>

<!-- eslint-disable svelte/no-at-html-tags -- documentation is trusted input, see SECURITY.md -->
<ul class="mt-8 mb-8 grid list-none gap-4 pl-0 sm:grid-cols-2" data-testid="cards">
	{#each cards as card, index (index)}
		<li
			class="border-base-200 dark:border-base-800 has-[>:first-child_a]:hover:border-accent-700 dark:has-[>:first-child_a]:hover:border-accent-500 relative mt-0 mb-0 rounded border p-5 text-base *:my-2 *:first:mt-0 *:last:mb-0"
		>
			<p
				class="text-base-900 dark:text-base-200 font-semibold [&_a]:font-semibold [&_a]:after:absolute [&_a]:after:inset-0"
			>
				{@html card.title}
			</p>
			{@html card.html}
		</li>
	{/each}
</ul>
