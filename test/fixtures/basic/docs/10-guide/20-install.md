# Install

## Usage

<!-- tabs -->

**npm**

```sh
npm install fixture
```

**bun**

```sh
bun add fixture
```

<!-- /tabs -->

### Live

```svelte live
<script>
	let n = $state(1);
</script>

<button class="demo-button" onclick={() => (n *= 2)}>{n}</button>
```

![Diagram](./diagram.svg)
