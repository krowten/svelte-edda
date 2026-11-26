import type { Page, Site } from '../pages.ts';

import { dirname, resolve } from 'node:path';

import { resolveAssetUrl, resolvePageLink } from '../pages.ts';
import { decodePath } from '../paths.ts';

// A code span, or a link whose text may hold an image: `[![badge](./a.svg)](./b.md)`.
const CODE_OR_LINK =
	/(?<!`)(`+)(?!`).*?(?<!`)\1(?!`)|(!?\[(?:[^[\]\n]|\[[^\]\n]*\](?:\([^)\n]*\))?)*\]\()(<[^>\n]+>|[^)\s]+)((?:\s+"[^"\n]*")?\))/g;
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

/**
 * Markdown served from the site (`/page.md`, `llms-full.txt`) lives at other paths than in the
 * repository, so relative links are pointed at the served Markdown and asset URLs.
 * Code blocks and code spans are left alone.
 */
export function rewriteSourceLinks(options: {
	site: Site;
	page: Page;
	source: string;
	/** Prepended to every rewritten URL, e.g. the site origin. */
	origin?: string;
}): string {
	const { site, page, source, origin = '' } = options;
	let fence: string | undefined;

	const rewrite = (target: string) => {
		const unwrapped = target.startsWith('<') ? target.slice(1, -1) : target;
		if (EXTERNAL.test(unwrapped)) return target;
		const hashIndex = unwrapped.search(/[?#]/);
		const path = hashIndex === -1 ? unwrapped : unwrapped.slice(0, hashIndex);
		const suffix = hashIndex === -1 ? '' : unwrapped.slice(hashIndex);
		if (!path) return target;
		const file = resolve(dirname(page.file), decodePath(path));
		const linked = file.endsWith('.md')
			? resolvePageLink(site, page, file)?.markdownUrl
			: undefined;
		const url = linked ?? resolveAssetUrl(site, page, file);
		return url ? origin + url + suffix : target;
	};

	const rewriteLinks = (text: string): string =>
		text.replace(
			CODE_OR_LINK,
			(match: string, code: string | undefined, open: string, target: string, close: string) =>
				code ? match : rewriteLinks(open) + rewrite(target) + close
		);

	return source
		.split('\n')
		.map((line) => {
			const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
			if (marker) {
				if (!fence) fence = marker;
				else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
				return line;
			}
			if (fence) return line;
			return rewriteLinks(line);
		})
		.join('\n');
}
