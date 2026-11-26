import type { ResolvedConfig } from './config.ts';
import type { Page, Site } from './pages.ts';

import { readFile } from 'node:fs/promises';

import { summaryOf } from './markdown/index.ts';
import { rewriteSourceLinks } from './markdown/source.ts';
import { firstHeading, readingOrder, splitFrontmatter } from './pages.ts';
import { isInside } from './paths.ts';

/** A page's Markdown as served at `page.markdownUrl`, with links pointing at served URLs. */
export async function servedMarkdown(site: Site, page: Page): Promise<string> {
	return rewriteSourceLinks({ site, page, source: await readFile(page.file, 'utf8') });
}

/**
 * `llms.txt`: an index of the Markdown versions of the pages (https://llmstxt.org), in the
 * default language only, which is also all that indexers such as Context7 read.
 */
export async function llmsTxt(config: ResolvedConfig, site: Site): Promise<string> {
	const origin = config.site ?? '';
	const lines = [`# ${config.title}`, ''];
	if (config.description) lines.push(`> ${config.description}`, '');
	lines.push('## Docs', '');
	for (const page of readingOrder(site.locales[0]!)) {
		// Tools open their pages with anything: only people's first paragraphs describe the page.
		const generated = config.generate.some((generator) => isInside(generator.dir, page.file));
		const description =
			page.description ??
			(generated ? undefined : summaryOf(config, await readFile(page.file, 'utf8')));
		lines.push(
			`- [${page.title}](${origin}${page.markdownUrl})${description ? `: ${description}` : ''}`
		);
	}
	lines.push('', '## Optional', '', `- [Full documentation](${origin}${config.base}llms-full.txt)`);
	return `${lines.join('\n')}\n`;
}

/** `llms-full.txt`: every page's Markdown in the default language, in reading order. */
export async function llmsFullTxt(config: ResolvedConfig, site: Site): Promise<string> {
	const parts = await Promise.all(
		readingOrder(site.locales[0]!).map(async (page) => {
			const { body } = splitFrontmatter(await readFile(page.file, 'utf8'));
			const content = rewriteSourceLinks({
				site,
				page,
				source: body.trim(),
				origin: config.site
			}).trim();
			return firstHeading(content) === undefined ? `# ${page.title}\n\n${content}` : content;
		})
	);
	return `${parts.join('\n\n---\n\n')}\n`;
}

const escapeXml = (value: string) =>
	value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

/**
 * `sitemap.xml` of the latest version in every language; needs `site` for absolute URLs.
 * Untranslated pages repeat the default language's ones and are left out. `modified` holds the
 * date of each URL's last commit, known since the page was rendered.
 */
export function sitemapXml(
	config: ResolvedConfig,
	site: Site,
	modified: Map<string, string | undefined>
): string | undefined {
	if (!config.site) return undefined;
	const entries = site.pages
		.filter((page) => !page.fallback)
		.map((page) => {
			const date = modified.get(page.url);
			const lastmod = date ? `<lastmod>${date}</lastmod>` : '';
			return `  <url><loc>${escapeXml(config.site + page.url)}</loc>${lastmod}</url>`;
		});
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

/**
 * `robots.txt` that points crawlers at the sitemap. Crawlers read it only at the root of a host,
 * so a site under a base path gets none; `undefined` without `site` or under a base path.
 */
export function robotsTxt(config: ResolvedConfig): string | undefined {
	if (!config.site || config.base !== '/') return undefined;
	return `User-agent: *\nAllow: /\n\nSitemap: ${config.site}/sitemap.xml\n`;
}
