// Runs as prepublishOnly. Until the first release goes out through CI, nothing reaches the
// public npm registry by accident: a publish aimed there is refused unless
// SVELTE_EDDA_NPM_RELEASE=1, which only the release workflow sets. Any other registry (a local
// one for trying a build out) passes.
//
// npm hands its effective registry to lifecycle scripts as npm_config_registry; absent, npm
// would use its default, the public registry. `bun publish` hands over no registry at all, so
// under bun the target is unknown and the publish is refused the same way: use npm for anything
// but a release.

const {
	npm_config_registry,
	npm_config_user_agent = '',
	SVELTE_EDDA_NPM_RELEASE,
	npm_package_name
} = process.env;

const unknown = npm_config_registry === undefined && npm_config_user_agent.startsWith('bun/');
// `||`, not `??`: npm passes an empty string when no registry is configured, and new URL('') throws.
const registry = new URL(npm_config_registry || 'https://registry.npmjs.org/');

if (SVELTE_EDDA_NPM_RELEASE !== '1' && (unknown || registry.host === 'registry.npmjs.org')) {
	console.error(
		`Refusing to publish ${npm_package_name ?? 'this package'}: ` +
			(unknown
				? 'bun publish does not say which registry it targets. '
				: 'that is the public npm registry. ') +
			'Releases go out through CI; to try a build elsewhere, use npm publish --registry <url>.'
	);
	process.exit(1);
}
