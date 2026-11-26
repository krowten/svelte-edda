<script lang="ts">
	let { html }: { html: string } = $props();
</script>

<div class="[&>ol]:list-none [&>ol]:pl-0" data-testid="steps">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- documentation is trusted input, see SECURITY.md -->
	{@html html}
</div>
