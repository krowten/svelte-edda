<script lang="ts">
	let count = $state(0);
</script>

<button type="button" data-testid="counter" onclick={() => count++}>Clicked {count}</button>
