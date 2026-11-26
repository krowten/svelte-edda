import type { Element, Root } from 'hast';
import type { VFile } from 'vfile';
import type { ResolvedConfig } from '../config.ts';
import type { Page, Site } from '../pages.ts';

import { dirname, relative, resolve } from 'node:path';

import { visit } from 'unist-util-visit';

import { resolveAssetUrl, resolvePageLink } from '../pages.ts';
import { decodePath, toPosix } from '../paths.ts';
import { collectIds, pageIds } from './headings.ts';
import { reportError, reportWarning } from './report.ts';

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

/**
 * Relative links keep working on GitHub and are rewritten for the site:
 * `./install.md#usage` becomes the page URL in the reader's language, `./diagram.png` an asset URL.
 */
export function rehypeLinks(options: { config: ResolvedConfig; site: Site; page: Page }) {
	const { config, site, page } = options;

	/** The id a link's `#fragment` asks for, or nothing when there is none to verify. */
	const fragmentOf = (suffix: string) => {
		const raw = suffix.slice(suffix.indexOf('#') + 1);
		// `#:~:text=` is a text fragment: it highlights a phrase and names no id.
		if (!suffix.includes('#') || !raw || raw.startsWith(':~:')) return undefined;
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	};

	const rewrite = async (
		node: Element,
		property: 'href' | 'src',
		file: VFile,
		ownIds: () => Set<string>
	) => {
		const value = node.properties[property];
		if (typeof value !== 'string' || !value) return;
		if (value.startsWith('#')) {
			const id = fragmentOf(value);
			if (id !== undefined && !ownIds().has(id)) {
				reportError(file, `Broken link: ${value} (no heading or id "${id}" on this page)`, node);
			}
			return;
		}
		// A path from the domain root skips `base`, so on a project site it leaves the documentation.
		if (/^\/(?!\/)/.test(value) && !value.startsWith(config.base)) {
			reportWarning(
				file,
				`${value} points outside the site, which is served under ${config.base}; link to the file instead, like ./page.md`,
				node
			);
		}
		if (EXTERNAL.test(value)) return;

		const hashIndex = value.search(/[?#]/);
		const path = hashIndex === -1 ? value : value.slice(0, hashIndex);
		const suffix = hashIndex === -1 ? '' : value.slice(hashIndex);
		if (!path) return;
		const target = resolve(dirname(page.file), decodePath(path));

		if (target.endsWith('.md')) {
			const linked = resolvePageLink(site, page, target);
			if (!linked) {
				reportError(
					file,
					`Broken link: ${value} (no page at ${toPosix(relative(config.root, target))})`,
					node
				);
				return;
			}
			const id = fragmentOf(suffix);
			if (id !== undefined && !(await pageIds(linked.file)).has(id)) {
				reportError(
					file,
					`Broken link: ${value} (no heading or id "${id}" in ${toPosix(relative(config.root, linked.file))})`,
					node
				);
			}
			node.properties[property] = linked.url + suffix;
			return;
		}

		const url = resolveAssetUrl(site, page, target);
		if (!url) {
			reportError(file, `Broken link: ${value} (file not found in the docs directory)`, node);
			return;
		}
		node.properties[property] = url + suffix;
	};

	return async (tree: Root, file: VFile) => {
		let ids: Set<string> | undefined;
		const ownIds = () => (ids ??= collectIds(tree));
		const found: [Element, 'href' | 'src'][] = [];
		visit(tree, 'element', (node) => {
			if (node.tagName === 'a') found.push([node, 'href']);
			else if (node.tagName === 'img' || node.tagName === 'source') found.push([node, 'src']);
		});
		for (const [node, property] of found) await rewrite(node, property, file, ownIds);
	};
}
