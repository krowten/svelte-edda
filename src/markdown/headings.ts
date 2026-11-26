import type { Root } from 'hast';

import { readFile, stat } from 'node:fs/promises';

import GithubSlugger from 'github-slugger';
import { toString } from 'hast-util-to-string';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export type Heading = { depth: number; id: string; text: string };

/** Gives every heading a GitHub-style id and collects `h2` and `h3` for the table of contents. */
export function rehypeHeadings(headings: Heading[]) {
	return (tree: Root) => {
		const slugger = new GithubSlugger();
		visit(tree, 'element', (node) => {
			const depth = /^h([1-6])$/.exec(node.tagName)?.[1];
			if (!depth) return;
			const text = toString(node);
			const id = typeof node.properties.id === 'string' ? node.properties.id : slugger.slug(text);
			node.properties.id = id;
			if (depth === '2' || depth === '3') headings.push({ depth: Number(depth), id, text });
		});
	};
}

/**
 * Every id a link can point at: headings and footnotes from the tree, plus ids written in raw
 * HTML such as `<a id="legacy-name"></a>`, which stays unparsed text.
 */
export function collectIds(tree: Root): Set<string> {
	const ids = new Set<string>();
	visit(tree, 'element', (node) => {
		if (typeof node.properties.id === 'string') ids.add(node.properties.id);
	});
	visit(tree, 'raw', (node) => {
		const html = node.value.replace(/<!--[\s\S]*?-->/g, '');
		for (const match of html.matchAll(/\s(?:id|name)=["']([^"']+)["']/g)) ids.add(match[1]!);
	});
	return ids;
}

const cache = new Map<string, { mtimeMs: number; ids: Set<string> }>();

/** The ids of another page, from the same parser and slugger that render it. */
export async function pageIds(file: string): Promise<Set<string>> {
	const { mtimeMs } = await stat(file);
	const cached = cache.get(file);
	if (cached?.mtimeMs === mtimeMs) return cached.ids;

	const source = await readFile(file, 'utf8');
	const processor = unified()
		.use(remarkParse)
		.use(remarkFrontmatter, ['yaml'])
		.use(remarkGfm)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeHeadings, []);
	const ids = collectIds((await processor.run(processor.parse(source))) as Root);
	cache.set(file, { mtimeMs, ids });
	return ids;
}
