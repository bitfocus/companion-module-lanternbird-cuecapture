import { ICON_PNG_BASE64 } from './icons-data.js'

/**
 * Returns the base64-encoded PNG for a bundled icon, or `undefined` if the
 * name isn't known (preset still renders text-only in that case).
 *
 * Icons are baked into the bundle at build time by scripts/build-icons.mjs —
 * companion-module-build bundles the module to a single main.js, so loose
 * asset files don't survive the bundle.
 */
export function tryLoadIcon(name: string): string | undefined {
	return ICON_PNG_BASE64[name]
}
