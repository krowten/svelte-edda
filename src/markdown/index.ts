import type { Root as HastRoot } from 'hast';
import type { Root as MdastRoot } from 'mdast';
import type { ResolvedConfig } from '../config.ts';
import type { Translate } from '../i18n/translator.ts';
import type { Page, Site } from '../pages.ts';
import type { RenderComponent } from './components.ts';
import type { Heading } from './headings.ts';

import { relative } from 'node:path';

import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { toHtml } from 'hast-util-to-html';
import { toString as hastToString } from 'hast-util-to-string';
import { toString as mdastToString } from 'mdast-util-to-string';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import { VFile } from 'vfile';

import { toPosix } from '../paths.ts';
import { remarkAlerts } from './alerts.ts';
import { getHighlighter, rehypeCodeBlocks, rehypeLiveDemos, shikiOptions } from './code.ts';
import { docsComponentHandler, rehypeComponents } from './components.ts';
import { remarkForeignSyntax } from './foreign.ts';
import { rehypeHeadings } from './headings.ts';
import { rehypeLinks } from './links.ts';
import { parseMarker, remarkMarkers } from './markers.ts';

export type { ComponentInstance, RenderComponent } from './components.ts';

export type { Heading } from './headings.ts';

export type Diagnostic = {
	/** Path relative to the project root. */
	file: string;
	line?: number;
	column?: number;
	message: string;
	severity: 'error' | 'warning';
};

export type RenderedMarkdown = {
	html: string;
	/** Whether the page opens with its own `# Title`; otherwise the layout shows the page title. */
	titled: boolean;
	/** `h2` and `h3` headings for the table of contents. */
	headings: Heading[];
	/** The first paragraph with text, as plain text cut to fit a search result snippet. */
	summary?: string;
	diagnostics: Diagnostic[];
};

const SUMMARY_LENGTH = 160;

/** Paragraphs inside alerts and components are not the page's opening, so only top-level ones count. */
export function summarize(tree: HastRoot): string | undefined {
	for (const node of tree.children) {
		if (node.type !== 'element' || node.tagName !== 'p') continue;
		const text = shorten(hastToString(node));
		if (text) return text;
	}
	return undefined;
}

/** The same summary from the Markdown alone, for an index that lists pages without rendering them. */
export function summaryOf(config: ResolvedConfig, source: string): string | undefined {
	const processor = unified()
		.use(remarkParse)
		.use(remarkFrontmatter, ['yaml'])
		.use(remarkGfm)
		.use(remarkMarkers, { components: config.components });
	for (const node of (processor.runSync(processor.parse(source)) as MdastRoot).children) {
		if (node.type !== 'paragraph') continue;
		const text = shorten(mdastToString(node, { includeImageAlt: false, includeHtml: false }));
		if (text) return text;
	}
	return undefined;
}

/** One line, cut at a word to the length of a search result snippet. */
function shorten(value: string): string {
	const text = value.replace(/\s+/g, ' ').trim();
	if (text.length <= SUMMARY_LENGTH) return text;
	const cut = text.slice(0, SUMMARY_LENGTH - 1);
	const space = cut.lastIndexOf(' ');
	return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

const COMMENT = /^<!--(?:(?!-->)[\s\S])*-->$/;

/**
 * Frontmatter and plain comments, such as the notice on generated pages, come before the title. A
 * component is content, though it may open with the title itself, as a hero does.
 */
function startsWithTitle(tree: MdastRoot, components: ResolvedConfig['components']): boolean {
	const marker = (node: MdastRoot['children'][number]) => {
		const parsed = node.type === 'html' ? parseMarker(node.value) : undefined;
		return parsed && components.has(parsed.name) ? parsed : undefined;
	};
	const [first, second] = tree.children.filter(
		(node) =>
			node.type !== 'yaml' &&
			!(node.type === 'html' && COMMENT.test(node.value.trim()) && !marker(node))
	);
	const opening = first && marker(first);
	const title = opening && !opening.selfClosing ? second : first;
	return title?.type === 'heading' && title.depth === 1 && mdastToString(title) !== '';
}

/** Wide tables scroll inside their own box instead of stretching the page. */
function rehypeTables() {
	return (tree: HastRoot) => {
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName !== 'table' || !parent || index === undefined) return;
			parent.children[index] = {
				type: 'element',
				tagName: 'div',
				// Focusable, so the keyboard can scroll it.
				properties: { className: ['overflow-x-auto'], tabIndex: 0 },
				children: [node]
			};
			return [SKIP, index + 1];
		});
	};
}

export async function renderMarkdown(options: {
	config: ResolvedConfig;
	site: Site;
	page: Page;
	source: string;
	/** Interface strings in the page's language. */
	t: Translate;
	render?: RenderComponent;
}): Promise<RenderedMarkdown> {
	const { config, site, page, source, t, render } = options;
	const headings: Heading[] = [];

	const processor = unified()
		.use(remarkParse)
		.use(remarkFrontmatter, ['yaml'])
		.use(remarkGfm)
		.use(remarkForeignSyntax, { components: config.components })
		.use(remarkAlerts, { t })
		.use(remarkMarkers, { components: config.components })
		.use(remarkRehype, {
			allowDangerousHtml: true,
			handlers: { docsComponent: docsComponentHandler as never }
		})
		.use(rehypeLiveDemos)
		.use(rehypeHeadings, headings)
		.use(rehypeTables)
		.use(rehypeLinks, { config, site, page })
		.use(rehypeShikiFromHighlighter, await getHighlighter(), shikiOptions)
		.use(rehypeCodeBlocks, { copy: t('code.copy'), copyLabel: t('code.copyLabel') })
		.use(rehypeComponents, {
			components: config.components,
			render,
			lang: page.locale?.lang ?? config.lang
		});

	const file = new VFile({ path: page.file, value: source });
	const parsed = processor.parse(file);
	const titled = startsWithTitle(parsed, config.components);
	const tree = await processor.run(parsed, file);

	const relativePath = toPosix(relative(config.root, page.file));
	return {
		html: toHtml(tree as HastRoot, { allowDangerousHtml: true }),
		titled,
		headings,
		summary: summarize(tree as HastRoot),
		diagnostics: file.messages
			.toSorted((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0))
			.map((message) => ({
				file: relativePath,
				line: message.line ?? undefined,
				column: message.column ?? undefined,
				message: message.reason,
				severity: message.fatal ? 'error' : 'warning'
			}))
	};
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
	const place = diagnostic.line ? `:${diagnostic.line}:${diagnostic.column ?? 1}` : '';
	return `${diagnostic.file}${place} ${diagnostic.severity}: ${diagnostic.message}`;
}
