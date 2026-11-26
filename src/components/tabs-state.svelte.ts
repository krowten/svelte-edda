const STORAGE_PREFIX = 'svelte-edda:tabs:';

// Shared by every tab group on the page, so groups with the same key switch together.
const selected = $state<Record<string, string>>({});

export function getSelected(key: string): string | undefined {
	return selected[key];
}

export function select(key: string, label: string): void {
	selected[key] = label;
	try {
		localStorage.setItem(STORAGE_PREFIX + key, label);
	} catch {
		// Storage can be unavailable (private mode, blocked cookies); the choice then lasts for the page.
	}
}

export function restore(key: string): void {
	if (key in selected) return;
	try {
		const saved = localStorage.getItem(STORAGE_PREFIX + key);
		if (saved) selected[key] = saved;
	} catch {
		// See `select`.
	}
}
