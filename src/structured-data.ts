import type { SidebarItem } from './pages.ts';

type Crumb = { title: string; url?: string };

/** Sidebar entries from the top down to the page at `url`. */
function trail(items: SidebarItem[], url: string): Crumb[] | undefined {
	for (const item of items) {
		if (item.url === url) return [item];
		if (item.type !== 'group') continue;
		const rest = trail(item.items, url);
		if (rest) return [item, ...rest];
	}
	return undefined;
}

export type StructuredDataInput = {
	/** Site origin, the `site` option. */
	origin: string;
	siteTitle: string;
	/** URL path of the language's home page. */
	home: string;
	sidebar: SidebarItem[];
	page: {
		url: string;
		title: string;
		description?: string;
		lang: string;
		/** `YYYY-MM-DD` */
		modified?: string;
		isHome: boolean;
	};
};

/**
 * schema.org objects for a page: `WebSite` for a home page, `TechArticle` and the sidebar path as
 * a `BreadcrumbList` for the rest. Groups without a page of their own are left out of the path,
 * because every crumb but the last needs a URL.
 */
export function structuredData(input: StructuredDataInput): object[] {
	const { origin, siteTitle, home, sidebar, page } = input;
	const website = { '@type': 'WebSite', name: siteTitle, url: origin + home };
	if (page.isHome) {
		return [
			{
				'@context': 'https://schema.org',
				...website,
				description: page.description,
				inLanguage: page.lang
			}
		];
	}
	const data: object[] = [
		{
			'@context': 'https://schema.org',
			'@type': 'TechArticle',
			headline: page.title,
			description: page.description,
			url: origin + page.url,
			inLanguage: page.lang,
			dateModified: page.modified,
			isPartOf: website
		}
	];
	const crumbs = [
		{ title: siteTitle, url: home },
		...(trail(sidebar, page.url) ?? []).filter((crumb) => crumb.url && crumb.url !== home)
	];
	if (crumbs.at(-1)?.url !== page.url) crumbs.push({ title: page.title, url: page.url });
	data.push({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.title,
			item: origin + crumb.url
		}))
	});
	return data;
}
