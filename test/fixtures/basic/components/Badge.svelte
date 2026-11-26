<script lang="ts">
	import type { Snippet } from 'svelte';

	let { tone, children }: { tone: string; children?: Snippet } = $props();
</script>

<span
	class="badge not-prose bg-accent-100 text-accent-900 rounded px-2"
	data-testid="badge"
	data-tone={tone}
>
	{@render children?.()}
</span>

<style>
	.badge {
		letter-spacing: 0.0625em;
	}
</style>
