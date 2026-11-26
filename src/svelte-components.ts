import type { Generator } from './types.ts';

import { glob, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { toPosix } from './paths.ts';

export type SvelteComponentsOptions = {
	/** Folder inside the docs directory for the generated pages. */
	dir: string;
	/** `.svelte` files, folders searched for them, and masks, relative to the config file. */
	components: string[];
	/** Files, folders and masks to leave out of `components`. */
	exclude?: string[];
	/** Title of the index page. Default: `Components`. */
	title?: string;
	/** Shown in every page's source and in the guide. Default: names `components`. */
	description?: string;
	/** Files and folders that make `dev` generate again, beside `components`. */
	watch?: string[];
	/** As in any generator: whether the pages are committed and compared by `check`. */
	commit?: boolean;
};

/**
 * A generator of reference pages for Svelte 5 components: one page per component with its props,
 * snippets and exports, and an index. For the `generate` option of the config.
 */
export function svelteComponents(options: SvelteComponentsOptions): Generator {
	const { dir, components, exclude = [], title = 'Components', watch = [], commit } = options;
	return {
		dir,
		description:
			options.description ??
			`Generated from the Svelte components in ${components.join(', ')}. Edit their props, comments and \`@component\` notes instead.`,
		watch: [...components.map((entry) => splitMask(entry).base), ...watch],
		commit,
		run: async ({ outDir, root }) => {
			// The compiler is heavy, and a config that names this generator is loaded by every command.
			const { parse } = await import('svelte/compiler');
			const reader = createReader(root, (code, filename) =>
				parse(code, { modern: true, filename })
			);
			const pages = new Map<string, Documented>();
			for (const { file, path } of await findComponents(root, components, exclude)) {
				const page = path.split('/').map(kebab).join('/');
				const other = page === 'index' ? 'the index page' : pages.get(page)?.file;
				if (other) throw new Error(`${path}.svelte and ${other} would share the page ${page}.md`);
				pages.set(page, await reader.component(file));
			}
			if (pages.size === 0) throw new Error(`no .svelte files in ${components.join(', ')}`);
			for (const [page, component] of pages) {
				const target = join(outDir, `${page}.md`);
				await mkdir(dirname(target), { recursive: true });
				await writeFile(target, componentPage(component));
			}
			const links = [...pages].map(
				([page, { name, summary }]) => `- [${name}](./${page}.md)${summary ? `: ${summary}` : ''}`
			);
			await writeFile(join(outDir, 'index.md'), `# ${title}\n\n${links.join('\n')}\n`);
		}
	};
}

const kebab = (name: string) =>
	name
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
		.toLowerCase();

/** A mask split into the folder it starts in and the rest: `src/lib`, `**` + `/*.svelte`. */
function splitMask(entry: string): { base: string; mask?: string } {
	const parts = toPosix(entry).split('/');
	const first = parts.findIndex((part) => /[*?{]/.test(part));
	if (first === -1) return { base: entry };
	return { base: parts.slice(0, first).join('/') || '.', mask: parts.slice(first).join('/') };
}

/** Component files named by files, folders and masks, with the path their pages get. */
async function findComponents(root: string, entries: string[], excluded: string[]) {
	const left = new Set((await filesOf(root, excluded, 'exclude')).keys());
	return [...(await filesOf(root, entries, 'components'))]
		.filter(([file]) => !left.has(file))
		.map(([file, path]) => ({ file, path }));
}

async function filesOf(root: string, entries: string[], option: string) {
	// A file named twice, say by its folder and a mask, is one component.
	const found = new Map<string, string>();
	const add = (file: string, path: string) => {
		if (!found.has(file)) found.set(file, path.slice(0, -'.svelte'.length));
	};
	for (const entry of entries) {
		const { base, mask } = splitMask(entry);
		const start = resolve(root, base);
		const info = await stat(start).catch(() => undefined);
		if (!info) throw new Error(`\`${option}\` names ${entry}, but there is no ${base}`);
		if (info.isFile()) {
			add(start, basename(start));
			continue;
		}
		const paths = mask
			? await Array.fromAsync(
					glob(mask, { cwd: start, exclude: (path) => basename(path) === 'node_modules' })
				)
			: await readdir(start, { recursive: true });
		for (const path of paths.map(toPosix).sort()) {
			const skipped = /(^|\/)(node_modules|[._][^/]*)(\/|$)/.test(path);
			if (path.endsWith('.svelte') && !skipped) add(join(start, path), path);
		}
	}
	return found;
}

type Documented = {
	file: string;
	name: string;
	description: string;
	/** First sentence or line of the description, for the index and the frontmatter. */
	summary: string;
	props: Member[];
	/** Types whose members are not listed: from packages, or computed from other types. */
	accepts: string[];
	/** The component takes props that no type in reach declares. */
	open: boolean;
	/** The `generics` attribute of the script. */
	generics?: string;
	exports: Member[];
};

type Member = {
	name: string;
	/** Source text of the type; unknown when nothing in reach declares it. */
	type?: string;
	required?: boolean;
	bindable?: boolean;
	default?: string;
	description: string;
	deprecated?: string;
};

// The compiler's TypeScript nodes are outside its published types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;
type Parse = (code: string, filename: string) => Node;
/** Declarations and imports of one file, with the source their positions refer to. */
type Scope = { file: string; code: string; body: Node[] };

function createReader(root: string, parse: Parse) {
	const scopes = new Map<string, Promise<Scope | undefined>>();

	const load = async (file: string): Promise<Scope | undefined> => {
		const source = await readFile(file, 'utf8').catch(() => undefined);
		if (source === undefined) return undefined;
		const code = file.endsWith('.svelte') ? source : `<script lang="ts">${source}</script>`;
		try {
			const ast = parse(code, file);
			return {
				file,
				code,
				body: [...(ast.module?.content.body ?? []), ...(ast.instance?.content.body ?? [])]
			};
		} catch {
			// A module the Svelte parser cannot read only leaves its types unlisted.
			return undefined;
		}
	};

	/** The module an import names: a relative path, or SvelteKit's `$lib`. */
	const imported = async (from: string, specifier: string): Promise<Scope | undefined> => {
		const base = specifier.startsWith('.')
			? resolve(dirname(from), specifier)
			: /^\$lib(\/|$)/.test(specifier)
				? join(root, 'src/lib', specifier.slice('$lib'.length))
				: undefined;
		if (!base) return undefined;
		const stem = base.replace(/\.(js|ts)$/, '');
		for (const file of [
			base,
			...[`${stem}.ts`, `${stem}.d.ts`, `${base}.ts`],
			...[join(base, 'index.ts'), join(base, 'index.d.ts')]
		]) {
			if (!/\.(ts|svelte)$/.test(file)) continue;
			if (!scopes.has(file)) scopes.set(file, load(file));
			const scope = await scopes.get(file);
			if (scope) return scope;
		}
		return undefined;
	};

	/** The declaration of a type, followed through imports and re-exports. */
	const declaration = async (
		name: string,
		scope: Scope,
		seen = new Set<string>()
	): Promise<{ node: Node; scope: Scope } | undefined> => {
		const key = `${scope.file}#${name}`;
		if (seen.has(key)) return undefined;
		seen.add(key);
		for (const statement of scope.body) {
			const node = statement.declaration ?? statement;
			if (/^TS(Interface|TypeAlias)Declaration$/.test(node.type) && node.id.name === name)
				return { node, scope };
		}
		for (const statement of scope.body) {
			if (!statement.source) continue;
			let other: string | undefined;
			if (statement.type === 'ExportAllDeclaration') other = name;
			for (const specifier of statement.specifiers ?? []) {
				const local = statement.type === 'ImportDeclaration' ? specifier.local : specifier.exported;
				const source =
					statement.type === 'ImportDeclaration' ? specifier.imported : specifier.local;
				if (local?.name === name) other = source?.name;
			}
			const module = other && (await imported(scope.file, statement.source.value));
			const found = module && (await declaration(other!, module, seen));
			if (found) return found;
		}
		return undefined;
	};

	const membersOf = async (
		node: Node,
		scope: Scope,
		seen: Set<Node> = new Set()
	): Promise<{ members: Member[]; accepts: string[] }> => {
		const text = () => oneLine(scope.code.slice(node.start, node.end));
		// A type's own member overrides an inherited one.
		const merge = async (parts: Node[], at: Scope, inside: Set<Node>, own: Member[] = []) => {
			const all = await Promise.all(parts.map((part) => membersOf(part, at, inside)));
			return {
				members: unique([...own, ...all.flatMap((part) => part.members)]),
				accepts: [...new Set(all.flatMap((part) => part.accepts))]
			};
		};
		switch (node.type) {
			case 'TSParenthesizedType':
				return membersOf(node.typeAnnotation, scope, seen);
			case 'TSTypeLiteral':
				return { members: listed(node.members, scope), accepts: [] };
			case 'TSIntersectionType':
				return merge(node.types, scope, seen);
			case 'TSTypeReference':
			case 'TSExpressionWithTypeArguments': {
				const name = (node.typeName ?? node.expression).name;
				const found = name ? await declaration(name, scope) : undefined;
				if (!found || seen.has(found.node)) return { members: [], accepts: [text()] };
				const inside = new Set([...seen, found.node]);
				if (found.node.type === 'TSTypeAliasDeclaration')
					return membersOf(found.node.typeAnnotation, found.scope, inside);
				const own = listed(found.node.body.body, found.scope);
				return merge(found.node.extends ?? [], found.scope, inside, own);
			}
			default:
				return { members: [], accepts: [text()] };
		}
	};

	const listed = (nodes: Node[], scope: Scope): Member[] =>
		nodes
			.filter((node) => /^TS(Property|Method)Signature$/.test(node.type) && !node.computed)
			.map((node) => ({
				name: keyOf(node.key),
				type:
					node.type === 'TSMethodSignature'
						? signature(scope.code.slice(node.key.end, node.end).replace(/^\?/, ''))
						: typeText(node, scope),
				required: !node.optional,
				...commentBefore(scope.code, node.start)
			}));

	return {
		async component(file: string): Promise<Documented> {
			const code = await readFile(file, 'utf8');
			const ast = parse(code, file);
			const instance: Node[] = ast.instance?.content.body ?? [];
			const scope = { file, code, body: [...(ast.module?.content.body ?? []), ...instance] };

			if (
				instance.some(
					(node) =>
						node.type === 'ExportNamedDeclaration' &&
						node.declaration?.type === 'VariableDeclaration' &&
						node.declaration.kind === 'let'
				)
			) {
				throw new Error(
					`${toPosix(relative(root, file))} declares props with \`export let\`; only runes (\`$props()\`) are read`
				);
			}

			const declared = instance
				.flatMap((node) => (node.type === 'VariableDeclaration' ? node.declarations : []))
				.find((node) => node.init?.type === 'CallExpression' && node.init.callee.name === '$props');
			const annotation = declared?.id.typeAnnotation?.typeAnnotation;
			const { members, accepts } = annotation
				? await membersOf(annotation, scope)
				: { members: [], accepts: [] };
			const pattern: Node[] = declared?.id.type === 'ObjectPattern' ? declared.id.properties : [];
			const props = new Map(members.map((member) => [member.name, member]));
			for (const node of pattern) {
				if (node.type !== 'Property') continue;
				const name = keyOf(node.key);
				const right = node.value.type === 'AssignmentPattern' ? node.value.right : undefined;
				const bindable = right?.type === 'CallExpression' && right.callee.name === '$bindable';
				const fallback = bindable ? right.arguments[0] : right;
				const known = props.get(name);
				props.set(name, {
					...(known ?? { name, ...commentBefore(code, node.start) }),
					// Without a type in reach only a default tells that a prop may be left out.
					required: known ? known.required : right ? false : undefined,
					bindable,
					default: fallback && oneLine(code.slice(fallback.start, fallback.end))
				});
			}

			const description = componentComment(ast.fragment.nodes);
			return {
				file: toPosix(relative(root, file)),
				name: basename(file, '.svelte'),
				description,
				// Plain text: the first paragraph, without the targets of its links.
				summary: oneLine(
					description.split(/\n\s*\n|\n(?=#)/)[0]!.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
				),
				props: [...props.values()],
				accepts,
				open: !annotation && pattern.some((node) => node.type === 'RestElement'),
				generics: ast.instance?.attributes.find((node: Node) => node.name === 'generics')?.value[0]
					?.data,
				exports: instance.flatMap((node) =>
					node.type === 'ExportNamedDeclaration' ? exported(node, code) : []
				)
			};
		}
	};
}

const unique = (members: Member[]) =>
	[...new Map(members.toReversed().map((member) => [member.name, member])).values()].toReversed();

const keyOf = (key: Node): string => String(key.name ?? key.value);

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const signature = (text: string) =>
	oneLine(text)
		.replace(/[;,]$/, '')
		.replace(/\)\s*:\s*/, ') => ');

function typeText(node: Node, scope: Scope): string | undefined {
	const type = node.typeAnnotation?.typeAnnotation;
	return type && oneLine(scope.code.slice(type.start, type.end));
}

/** Functions and constants a parent reaches through `bind:this`. */
function exported(node: Node, code: string): Member[] {
	const declaration = node.declaration;
	const comment = commentBefore(code, node.start);
	if (declaration?.type === 'FunctionDeclaration') {
		const head = code.slice(declaration.id.end, declaration.body.start);
		return [{ name: declaration.id.name, type: signature(head), ...comment }];
	}
	if (declaration?.type !== 'VariableDeclaration') return [];
	return declaration.declarations.map((item: Node) => ({
		name: item.id.name,
		type: typeText(item.id, { file: '', code, body: [] }),
		...comment
	}));
}

/** The JSDoc comment that ends right before `position`. */
function commentBefore(
	code: string,
	position: number
): { description: string; deprecated?: string } {
	const before = code.slice(0, position).trimEnd();
	const start = before.endsWith('*/') ? before.lastIndexOf('/*') : -1;
	if (start === -1 || !before.startsWith('/**', start)) return { description: '' };
	const text = before
		.slice(start + 3, -2)
		.split('\n')
		.map((line) => line.replace(/^\s*\*? ?/, ''))
		.join('\n')
		.replace(/\{@link\s+([^\s|}]+)[^}]*\}/g, '`$1`');
	const [description, ...tags] = `\n${text}`.split(/\n\s*(?=@\w)/);
	const deprecated = tags.find((tag) => tag.startsWith('@deprecated'));
	return {
		description: oneLine(description!),
		deprecated: deprecated && oneLine(deprecated.slice('@deprecated'.length))
	};
}

/** The Markdown of `<!-- @component … -->`, without the indentation of the comment. */
function componentComment(nodes: Node[]): string {
	const text: string | undefined = nodes
		.find((node) => node.type === 'Comment' && /^\s*@component\b/.test(node.data))
		?.data.replace(/^\s*@component[ \t]*/, '');
	if (!text) return '';
	const [first, ...lines] = text.split('\n');
	const indents = lines.filter((line) => line.trim()).map((line) => /^\s*/.exec(line)![0].length);
	const indent = Math.min(...indents, Infinity);
	return [first, ...lines.map((line) => line.slice(Math.min(indent, line.length)))]
		.join('\n')
		.trim();
}

/** Text in a table cell: a `|` would end it. */
const cell = (text: string) => text.replaceAll('|', '\\|');

function code(text: string | undefined): string {
	if (!text) return '';
	const fence = text.includes('`') ? '``' : '`';
	return cell(fence === '`' ? `\`${text}\`` : `${fence} ${text} ${fence}`);
}

function table(head: string[], rows: string[][]): string {
	return [head, head.map(() => '---'), ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

function explained({ description, deprecated }: Member): string {
	const notes = deprecated === undefined ? [] : [`**Deprecated.** ${deprecated}`.trim()];
	return cell([...notes, description].filter(Boolean).join(' '));
}

function componentPage({
	name,
	description,
	summary,
	props,
	accepts,
	open,
	generics,
	exports
}: Documented) {
	const isSnippet = (prop: Member) => /^Snippet\b/.test(prop.type ?? '');
	const required = (prop: Member) =>
		prop.required === undefined ? '' : prop.required ? 'yes' : 'no';
	const plain = props.filter((prop) => !isSnippet(prop));
	const snippets = props.filter(isSnippet);
	const others = accepts.map(code).join(', ');
	const sections = [
		`---\ntitle: ${JSON.stringify(name)}\n${summary ? `description: ${JSON.stringify(summary)}\n` : ''}---`,
		`# ${name}`,
		description,
		'## Props',
		generics ? `Type parameters: ${code(oneLine(generics))}.` : '',
		plain.length > 0
			? table(
					['Name', 'Type', 'Required', 'Default', 'Description'],
					plain.map((prop) => [
						`${code(prop.name)}${prop.bindable ? ' (bindable)' : ''}`,
						code(prop.type),
						required(prop),
						code(prop.default),
						explained(prop)
					])
				)
			: others || open
				? ''
				: 'None.',
		others
			? `Also takes the props of ${others}.`
			: open
				? 'Also takes props that are not listed here.'
				: '',
		...(snippets.length > 0
			? [
					'## Snippets',
					table(
						['Name', 'Type', 'Required', 'Description'],
						snippets.map((prop) => [
							code(prop.name),
							code(prop.type),
							required(prop),
							explained(prop)
						])
					)
				]
			: []),
		...(exports.length > 0
			? [
					'## Exports',
					table(
						['Name', 'Type', 'Description'],
						exports.map((item) => [code(item.name), code(item.type), explained(item)])
					)
				]
			: [])
	];
	return `${sections.filter(Boolean).join('\n\n')}\n`;
}
