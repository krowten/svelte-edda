import type { Component } from 'svelte';

import { createRawSnippet, hydrate } from 'svelte';

import { SIDEBAR_KEY, THEME_KEY } from './keys.ts';

type IslandModule = { default: Component<Record<string, unknown>> };

export type StartOptions = {
	base: string;
	/** `src` is set in dev, where islands load straight from their source files. */
	load: (name: string, src: string | undefined) => Promise<IslandModule>;
};

/** Interface strings rendered into the page in its language; see `clientMessages` in render.ts. */
type Messages = {
	copy: string;
	copied: string;
	copyFailed: string;
	noResults: string;
	searchUnavailable: string;
	navOpen: string;
	navClose: string;
};

function readMessages(): Messages {
	const script = document.getElementById('svelte-edda-messages');
	return JSON.parse(script?.textContent ?? '{}') as Messages;
}

export function start(options: StartOptions): void {
	const messages = readMessages();
	setupTheme();
	setupSidebar(messages);
	setupSidebarGroups();
	setupMenus();
	setupCopy(messages);
	setupSearch(options.base, messages);
	setupToc();
	void hydrateIslands(options);
}

async function hydrateIslands(options: StartOptions) {
	const islands = document.querySelectorAll<HTMLElement>('docs-island');
	await Promise.all(
		[...islands].map(async (element) => {
			const { name = '', src, props = '{}', children } = element.dataset;
			try {
				const { default: component } = await options.load(name, src);
				const parsed = JSON.parse(props) as Record<string, unknown>;
				if (children !== undefined) {
					parsed.children = createRawSnippet(() => ({
						render: () => `<div class="docs-children contents">${children}</div>`
					}));
				}
				hydrate(component, { target: element, props: parsed });
			} catch (error) {
				console.error(`svelte-edda: failed to hydrate "${name}"`, error);
			}
		})
	);
}

function setupTheme() {
	document.addEventListener('click', (event) => {
		if (!(event.target as Element).closest('[data-theme-toggle]')) return;
		const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = next;
		try {
			localStorage.setItem(THEME_KEY, next);
		} catch {
			// The choice then lasts for the page.
		}
	});
}

function setupSidebar(messages: Messages) {
	const button = document.querySelector<HTMLButtonElement>('[data-sidebar-toggle]');
	if (!button) return;
	const root = document.documentElement;
	const toggle = (open: boolean) => {
		if (open) root.dataset.sidebar = 'open';
		else delete root.dataset.sidebar;
		button.setAttribute('aria-expanded', String(open));
		button.setAttribute('aria-label', open ? messages.navClose : messages.navOpen);
	};
	button.addEventListener('click', () => toggle(root.dataset.sidebar !== 'open'));
	// The button may not exist at the new width, and the menu would have no way to close.
	matchMedia('(min-width: 64rem)').addEventListener('change', () => toggle(false));
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && root.dataset.sidebar === 'open') toggle(false);
	});
}

/**
 * Sidebar groups open and close; the choice lasts for the session, since every page load renders
 * the groups afresh. Then the sidebar scrolls to the current page, which a long one would hide.
 */
function setupSidebarGroups() {
	let saved: Record<string, boolean> = {};
	try {
		saved = JSON.parse(sessionStorage.getItem(SIDEBAR_KEY) ?? '{}') as Record<string, boolean>;
	} catch {
		// Without storage the groups start as rendered on every page.
	}
	for (const button of document.querySelectorAll<HTMLButtonElement>(
		'[data-sidebar-group-toggle]'
	)) {
		const list = document.getElementById(button.getAttribute('aria-controls') ?? '');
		const key = button.dataset.key ?? '';
		const set = (open: boolean) => {
			button.setAttribute('aria-expanded', String(open));
			if (list) list.hidden = !open;
		};
		// The group holding the current page, as its own page or inside, stays open whatever was
		// chosen before.
		const holdsCurrent = button.closest('li')?.querySelector('[aria-current="page"]');
		if (key in saved && !holdsCurrent) set(saved[key]!);
		button.addEventListener('click', () => {
			const open = button.getAttribute('aria-expanded') !== 'true';
			set(open);
			saved[key] = open;
			try {
				sessionStorage.setItem(SIDEBAR_KEY, JSON.stringify(saved));
			} catch {
				// The choice then lasts for the page.
			}
		});
	}

	const sidebar = document.getElementById('docs-sidebar');
	const current = sidebar?.querySelector<HTMLElement>('[aria-current="page"]');
	if (sidebar && current && current.offsetTop + current.offsetHeight > sidebar.clientHeight) {
		sidebar.scrollTop = current.offsetTop - sidebar.clientHeight / 2;
	}
}

/** Language and version menus are `<details>`: close them on an outside click or Escape. */
function setupMenus() {
	const close = (except?: Element | null) => {
		for (const menu of document.querySelectorAll<HTMLDetailsElement>('details.docs-menu[open]')) {
			if (menu !== except) menu.open = false;
		}
	};
	document.addEventListener('click', (event) =>
		close((event.target as Element).closest('details.docs-menu'))
	);
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') close();
	});
}

/** Marks the table of contents entry of the section at the top of the viewport. */
function setupToc() {
	const links = new Map<Element, HTMLAnchorElement>();
	for (const link of document.querySelectorAll<HTMLAnchorElement>('a.docs-toc-link')) {
		const heading = document.getElementById(decodeURIComponent(link.hash.slice(1)));
		if (heading) links.set(heading, link);
	}
	if (links.size === 0) return;
	const headings = [...links.keys()];
	const update = () => {
		// The last heading above the line just below the sticky header; the first one before that.
		// At the end of the page the last section may be too short to get there.
		const page = document.documentElement;
		const atEnd = page.scrollTop > 0 && page.scrollTop + page.clientHeight >= page.scrollHeight - 2;
		const current = atEnd
			? headings.at(-1)
			: headings.findLast((heading) => heading.getBoundingClientRect().top <= 96);
		for (const [heading, link] of links) {
			if (heading === (current ?? headings[0])) link.setAttribute('aria-current', 'true');
			else link.removeAttribute('aria-current');
		}
	};
	let queued = false;
	document.addEventListener(
		'scroll',
		() => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => {
				queued = false;
				update();
			});
		},
		{ passive: true }
	);
	update();
}

function setupCopy(messages: Messages) {
	const timers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();
	document.addEventListener('click', async (event) => {
		const button = (event.target as Element).closest<HTMLButtonElement>('[data-copy]');
		const code = button?.parentElement?.querySelector('pre');
		if (!button || !code) return;
		try {
			await navigator.clipboard.writeText(code.textContent ?? '');
			button.textContent = messages.copied;
			button.dataset.copied = '';
		} catch {
			button.textContent = messages.copyFailed;
		}
		clearTimeout(timers.get(button));
		timers.set(
			button,
			setTimeout(() => {
				button.textContent = messages.copy;
				delete button.dataset.copied;
			}, 1500)
		);
	});
}

type PagefindResult = {
	data: () => Promise<{ url: string; excerpt: string; meta: { title?: string } }>;
};
type Pagefind = {
	options: (options: { baseUrl: string }) => Promise<void>;
	debouncedSearch: (query: string) => Promise<{ results: PagefindResult[] } | null>;
};

function setupSearch(base: string, messages: Messages) {
	const dialog = document.querySelector<HTMLDialogElement>('[data-search-dialog]');
	const input = dialog?.querySelector<HTMLInputElement>('[data-search-input]');
	const status = dialog?.querySelector<HTMLElement>('[data-search-status]');
	const list = dialog?.querySelector<HTMLUListElement>('[data-search-results]');
	if (!dialog || !input || !status || !list) return;

	let pagefind: Promise<Pagefind | undefined> | undefined;
	const loadPagefind = () =>
		(pagefind ??= import(/* @vite-ignore */ `${base}pagefind/pagefind.js`)
			.then(async (module: Pagefind) => {
				await module.options({ baseUrl: base });
				return module;
			})
			.catch(() => undefined));

	const open = () => {
		if (dialog.open) return;
		dialog.showModal();
		input.select();
		void loadPagefind();
	};

	document.addEventListener('click', (event) => {
		if ((event.target as Element).closest('[data-search-open]')) open();
		// A click on the backdrop lands on the dialog itself.
		if (event.target === dialog) dialog.close();
	});
	document.addEventListener('keydown', (event) => {
		const typing = (event.target as Element).closest('input, textarea, select, [contenteditable]');
		if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
			event.preventDefault();
			open();
		}
	});

	// Escape in a search field clears it instead of closing the dialog.
	input.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') dialog.close();
	});

	input.addEventListener('input', async () => {
		const query = input.value.trim();
		if (!query) {
			list.replaceChildren();
			status.textContent = '';
			return;
		}
		const engine = await loadPagefind();
		if (!engine) {
			status.textContent = messages.searchUnavailable;
			return;
		}
		const search = await engine.debouncedSearch(query);
		if (!search) return; // superseded by a newer query
		const results = await Promise.all(search.results.slice(0, 8).map((result) => result.data()));
		// Clearing the field starts no search, so nothing has superseded this one.
		if (input.value.trim() !== query) return;
		status.textContent = results.length === 0 ? messages.noResults.replace('\u0000', query) : '';
		list.replaceChildren(
			...results.map((result) => {
				const item = document.createElement('li');
				const link = document.createElement('a');
				link.href = result.url;
				link.dataset.testid = 'search-result';
				link.className =
					'block border-b border-base-100 px-4 py-3 last:border-0 hover:bg-base-50 focus:bg-base-50 dark:border-base-800 dark:hover:bg-base-800 dark:focus:bg-base-800';
				const title = document.createElement('span');
				title.className = 'block font-medium text-base-900 dark:text-base-200';
				title.textContent = result.meta.title ?? result.url;
				const excerpt = document.createElement('span');
				excerpt.className =
					'mt-1 block text-sm text-base-600 dark:text-base-400 [&_mark]:rounded-sm [&_mark]:bg-accent-100 [&_mark]:text-inherit dark:[&_mark]:bg-accent-900/60';
				// Pagefind escapes page text and only adds <mark> around matches.
				excerpt.innerHTML = result.excerpt;
				link.append(title, excerpt);
				item.append(link);
				return item;
			})
		);
	});
}
