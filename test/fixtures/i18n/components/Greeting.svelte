<script lang="ts">
	let { lang }: { lang: string } = $props();

	const words: Record<string, string> = { en: 'Hello', ru: 'Привет' };
	let count = $state(0);
</script>

<button type="button" data-testid="greeting" onclick={() => count++}>
	{words[lang] ?? words.en}
	{count}
</button>
