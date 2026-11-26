<script lang="ts">
	import type { LayoutProps } from './types.ts';

	import Menu from './Menu.svelte';
	import Sidebar from './Sidebar.svelte';

	let {
		site,
		home,
		sidebar,
		nav,
		languages,
		versions,
		archived,
		untranslated,
		page,
		t
	}: LayoutProps = $props();

	const landing = $derived(page.layout === 'landing');
	// Text and footer share one column: the reading width, or a wider centred one on a landing page.
	const column = $derived(landing ? 'mx-auto max-w-5xl' : 'max-w-3xl');

	const navLink = (link: LayoutProps['nav'][number]) =>
		link.current
			? 'text-accent-700 dark:text-accent-500'
			: 'text-base-600 hover:text-base-900 dark:text-base-400 dark:hover:text-base-200';
	// `page` for the link's own page, `true` for the other pages of its section.
	const ariaCurrent = (link: LayoutProps['nav'][number]) =>
		link.url === page.url ? 'page' : link.current ? 'true' : undefined;

	const iconButton =
		'inline-flex size-9 items-center justify-center rounded text-base-600 hover:bg-base-100 hover:text-base-900 dark:text-base-400 dark:hover:bg-base-800 dark:hover:text-base-200';
</script>

<a
	href="#content"
	class="bg-accent-700 sr-only z-50 rounded px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
>
	{t('skipLink.label')}
</a>

<header
	data-testid="site-header"
	class="border-base-200 dark:border-base-800 dark:bg-base-900/90 sticky top-0 z-30 border-b bg-white/90 backdrop-blur"
>
	<div class="mx-auto flex h-15 max-w-screen-2xl items-center gap-3 px-4 sm:px-8">
		<button
			type="button"
			class="{iconButton} {landing && nav.length === 0 ? '' : 'lg:hidden'}"
			data-sidebar-toggle
			aria-controls="docs-sidebar"
			aria-expanded="false"
			aria-label={t('nav.open')}
		>
			<svg
				viewBox="0 0 24 24"
				class="size-5"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
			</svg>
		</button>

		<a
			href={home}
			data-testid="site-home"
			class="text-base-900 dark:text-base-200 flex min-w-0 items-center text-xl font-medium"
		>
			<!-- A logo replaces the name, so it carries the name as its text alternative. -->
			{#if site.logo}
				<img
					src={site.logo.src}
					alt={site.title}
					class="h-8 w-auto {site.logo.dark ? 'dark:hidden' : ''}"
				/>
				{#if site.logo.dark}
					<img src={site.logo.dark} alt={site.title} class="hidden h-8 w-auto dark:block" />
				{/if}
			{:else}
				<span class="truncate">{site.title}</span>
			{/if}
		</a>

		{#if nav.length > 0}
			<nav
				aria-label={t('nav.main')}
				data-testid="header-nav"
				class="ml-4 hidden items-center gap-1 lg:flex"
			>
				{#each nav as link (link.url)}
					<a
						href={link.url}
						aria-current={ariaCurrent(link)}
						class="rounded px-3 py-2 text-sm font-medium {navLink(link)}"
					>
						{link.title}
					</a>
				{/each}
			</nav>
		{/if}

		<div class="ml-auto flex items-center gap-1">
			<button
				type="button"
				data-search-open
				data-testid="search-open"
				class="border-base-200 bg-base-50 text-base-500 hover:border-base-300 hover:text-base-800 dark:border-base-800 dark:bg-base-800 dark:text-base-400 dark:hover:border-base-700 dark:hover:text-base-200 mr-1 flex h-9 items-center gap-2 rounded border px-3 text-sm sm:w-56"
			>
				<svg
					viewBox="0 0 24 24"
					class="size-4"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" stroke-linecap="round" />
				</svg>
				<span class="hidden sm:inline">{t('search.label')}</span>
				<span class="sr-only sm:hidden">{t('search.label')}</span>
				<kbd
					class="border-base-200 dark:border-base-700 ml-auto hidden rounded border px-1.5 font-sans text-xs sm:inline"
				>
					{t('search.shortcut')}
				</kbd>
			</button>

			{#if versions.length > 0}
				<Menu label={t('version.label')} items={versions} testid="version-menu" />
			{/if}
			{#if languages.length > 0}
				<Menu label={t('language.label')} items={languages} testid="language-menu" />
			{/if}

			{#if site.repository}
				<a href={site.repository} class={iconButton} aria-label={t('repository.label')}>
					<svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
						<path
							d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49l-.01-1.7c-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.64-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9l-.01 2.81c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
						/>
					</svg>
				</a>
			{/if}

			<button
				type="button"
				class={iconButton}
				data-theme-toggle
				data-testid="theme-toggle"
				aria-label={t('theme.toggle')}
			>
				<svg
					viewBox="0 0 24 24"
					class="size-5 dark:hidden"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" stroke-linejoin="round" />
				</svg>
				<svg
					viewBox="0 0 24 24"
					class="hidden size-5 dark:block"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="4" />
					<path
						d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</div>
	</div>
</header>

<div class="mx-auto flex max-w-screen-2xl">
	<nav
		id="docs-sidebar"
		aria-label={t('nav.label')}
		data-testid="sidebar"
		class="border-base-200 dark:border-base-800 dark:bg-base-900 fixed inset-x-0 top-15 bottom-0 z-20 hidden h-[calc(100dvh-(--spacing(15)))] overflow-y-auto border-r bg-white px-4 py-8 in-data-[sidebar=open]:block {landing
			? 'lg:right-auto lg:w-72'
			: 'lg:sticky lg:block lg:w-72 lg:shrink-0'}"
	>
		{#if nav.length > 0}
			<!-- The header links live here on screens too narrow for them in the header. -->
			<ul
				data-testid="drawer-nav"
				class="border-base-200 dark:border-base-800 mb-6 space-y-0.5 border-b pb-6 lg:hidden"
			>
				{#each nav as link (link.url)}
					<li>
						<a
							href={link.url}
							aria-current={ariaCurrent(link)}
							class="block rounded px-2 py-1.5 text-sm font-medium {navLink(link)}"
						>
							{link.title}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<Sidebar items={sidebar} current={page.url} {t} />
	</nav>

	<main
		id="content"
		data-layout={page.layout}
		class="min-w-0 flex-1 px-4 pt-15 pb-20 sm:px-8 md:pt-20 lg:px-12"
	>
		{#if archived}
			<p
				data-testid="archived-banner"
				role="note"
				class="{column} mb-8 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
			>
				{t('version.archived', { version: archived.label })}
				<a href={archived.latestUrl} class="font-medium underline underline-offset-2">
					{t('version.goLatest')}
				</a>
			</p>
		{/if}
		{#if untranslated}
			<p
				data-testid="untranslated-banner"
				role="note"
				class="{column} mb-8 rounded border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
			>
				{t('language.untranslated', { language: untranslated.language })}
			</p>
		{/if}

		<!-- Pages without `data-pagefind-body` stay out of the search index. -->
		<article
			data-testid="page-content"
			data-pagefind-body={page.searchable ? '' : undefined}
			lang={untranslated?.lang}
			class="prose prose-lg prose-docs dark:prose-invert prose-headings:font-semibold prose-a:underline-offset-2 prose-code:not-in-[pre]:bg-base-100 dark:prose-code:not-in-[pre]:bg-base-800 prose-code:not-in-[pre]:rounded prose-code:not-in-[pre]:px-1 prose-code:not-in-[pre]:py-0.5 prose-code:not-in-[pre]:font-normal prose-code:not-in-[pre]:before:content-none prose-code:not-in-[pre]:after:content-none {column}"
		>
			{#if page.title && !landing}
				<h1>{page.title}</h1>
			{/if}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- documentation is trusted input, see SECURITY.md -->
			{@html page.html}
		</article>

		<!-- A landing page ends with its own content: no edit link, date or previous/next. -->
		{#if !landing}
			<footer class="{column} border-base-200 dark:border-base-800 mt-20 border-t pt-8 text-sm">
				{#if page.editUrl || page.markdownUrl || page.updated}
					<div class="text-base-600 dark:text-base-400 flex flex-wrap gap-x-6 gap-y-2">
						{#if page.editUrl}
							<a
								href={page.editUrl}
								class="hover:text-accent-700 dark:hover:text-accent-500"
								data-testid="edit-link"
							>
								{t('page.edit')}
							</a>
						{/if}
						{#if page.markdownUrl}
							<a href={page.markdownUrl} class="hover:text-accent-700 dark:hover:text-accent-500">
								{t('page.markdown')}
							</a>
						{/if}
						{#if page.updated}
							<time datetime={page.updated.date} data-testid="page-updated" class="sm:ml-auto">
								{t('page.updated', { date: page.updated.text })}
							</time>
						{/if}
					</div>
				{/if}
				{#if page.prev || page.next}
					<nav aria-label={t('page.pagination')} class="mt-8 grid gap-4 sm:grid-cols-2">
						{#if page.prev}
							<a
								href={page.prev.url}
								rel="prev"
								data-testid="prev-page"
								class="hover:border-accent-700 dark:hover:border-accent-500 border-base-200 dark:border-base-800 rounded border p-4"
							>
								<span class="text-base-500 dark:text-base-400 block text-xs">
									{t('page.previous')}
								</span>
								<span class="text-base-900 dark:text-base-200 text-base font-medium">
									{page.prev.title}
								</span>
							</a>
						{/if}
						{#if page.next}
							<a
								href={page.next.url}
								rel="next"
								data-testid="next-page"
								class="hover:border-accent-700 dark:hover:border-accent-500 border-base-200 dark:border-base-800 rounded border p-4 text-right sm:col-start-2"
							>
								<span class="text-base-500 dark:text-base-400 block text-xs">
									{t('page.next')}
								</span>
								<span class="text-base-900 dark:text-base-200 text-base font-medium">
									{page.next.title}
								</span>
							</a>
						{/if}
					</nav>
				{/if}
			</footer>
		{/if}
	</main>

	{#if page.headings.length > 0 && !landing}
		<aside
			class="sticky top-15 hidden h-[calc(100dvh-(--spacing(15)))] w-64 shrink-0 overflow-y-auto pt-20 pr-8 pb-8 xl:block"
		>
			<nav aria-labelledby="toc-title" data-testid="toc">
				<p id="toc-title" class="text-base-900 dark:text-base-200 text-sm font-semibold">
					{t('toc.title')}
				</p>
				<ul class="mt-4 space-y-2 text-sm">
					{#each page.headings as heading (heading.id)}
						<li class={heading.depth === 3 ? 'pl-3' : ''}>
							<a
								href="#{heading.id}"
								class="docs-toc-link aria-current:text-accent-700 dark:aria-current:text-accent-500 hover:text-accent-700 dark:hover:text-accent-500 text-base-600 dark:text-base-400 aria-current:font-medium"
							>
								{heading.text}
							</a>
						</li>
					{/each}
				</ul>
			</nav>
		</aside>
	{/if}
</div>

<dialog
	data-search-dialog
	data-testid="search-dialog"
	aria-label={t('search.label')}
	class="border-base-200 text-base-800 backdrop:bg-base-900/50 dark:border-base-800 dark:bg-base-900 dark:text-base-300 mx-auto mt-24 w-11/12 max-w-2xl rounded border bg-white p-0 shadow-2xl"
>
	<form
		method="dialog"
		class="border-base-200 dark:border-base-800 flex items-center gap-2 border-b px-4"
	>
		<svg
			viewBox="0 0 24 24"
			class="text-base-400 dark:text-base-500 size-5 shrink-0"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" stroke-linecap="round" />
		</svg>
		<input
			type="search"
			data-search-input
			data-testid="search-input"
			aria-label={t('search.placeholder')}
			placeholder={t('search.placeholder')}
			class="placeholder:text-base-400 dark:placeholder:text-base-500 h-12 w-full bg-transparent text-base outline-none"
		/>
		<button
			class="border-base-200 text-base-500 dark:border-base-700 dark:text-base-400 rounded border px-1.5 text-xs"
		>
			{t('search.close')}
		</button>
	</form>
	<div
		data-search-status
		data-testid="search-status"
		role="status"
		class="text-base-500 dark:text-base-400 px-4 py-3 text-sm empty:hidden"
	></div>
	<ul
		data-search-results
		data-testid="search-results"
		class="max-h-96 overflow-y-auto empty:hidden"
	></ul>
</dialog>
