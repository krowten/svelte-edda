<script lang="ts">
	let { html, aside }: { html: string; aside?: string } = $props();
</script>

<!-- eslint-disable svelte/no-at-html-tags -- documentation is trusted input, see SECURITY.md -->
<div
	class="grid grid-cols-1 items-center gap-10 pt-4 pb-12 {aside ? 'lg:grid-cols-2' : ''}"
	data-testid="hero"
>
	<div class="min-w-0 [&>h1]:mb-4 [&>h1]:text-5xl sm:[&>h1]:text-6xl [&>h1+p]:text-xl">
		{@html html}
	</div>
	{#if aside}
		<div class="min-w-0">{@html aside}</div>
	{/if}
</div>
