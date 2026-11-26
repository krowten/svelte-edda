import type { ComponentDefinition, DocsConfig } from './types.ts';

export type {
	AttributeDefinition,
	AttributeValue,
	ComponentDefinition,
	DocsConfig,
	GenerateContext,
	Generator,
	HeadContext,
	LocaleConfig,
	LocalizedText,
	NavLink,
	PrepareContext,
	SidebarEntry,
	SidebarGroup,
	VersionConfig
} from './types.ts';
export type { MessageKey } from './i18n/messages.ts';
export type { SvelteComponentsOptions } from './svelte-components.ts';

export { svelteComponents } from './svelte-components.ts';

export function defineConfig(config: DocsConfig): DocsConfig {
	return config;
}

export function defineComponent(component: ComponentDefinition): ComponentDefinition {
	return component;
}
