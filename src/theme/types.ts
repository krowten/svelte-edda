import type { Translate } from '../i18n/translator.ts';
import type { Heading } from '../markdown/index.ts';
import type { SidebarItem } from '../pages.ts';

export type LayoutLink = { title: string; url: string; current?: boolean; lang?: string };

export type LayoutProps = {
	site: {
		title: string;
		logo?: { src: string; dark?: string; alt: string };
		repository?: string;
	};
	/** Home page of the current language and version. */
	home: string;
	sidebar: SidebarItem[];
	/** Header links; `current` marks the one whose sidebar section holds the page. */
	nav: LayoutLink[];
	/** Language menu; empty for monolingual docs. */
	languages: LayoutLink[];
	/** Version menu; empty without archived versions. */
	versions: LayoutLink[];
	/** Set on pages of an archived version. */
	archived?: { label: string; latestUrl: string };
	/** Set when the page is shown in the default language for lack of a translation. */
	untranslated?: { language: string; lang: string };
	page: {
		url: string;
		layout: 'docs' | 'landing';
		/** Shown as the heading when the page's Markdown has none of its own. */
		title?: string;
		html: string;
		headings: Heading[];
		markdownUrl?: string;
		editUrl?: string;
		/** Date of the last change: machine-readable and in the page's language. */
		updated?: { date: string; text: string };
		prev?: LayoutLink;
		next?: LayoutLink;
		/** Whether Pagefind indexes the page. */
		searchable: boolean;
	};
	t: Translate;
};
