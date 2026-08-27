/* eslint-disable n/no-unpublished-import, n/no-process-exit */
// Rasterizes the SVG sources below to 144×144 PNGs.
//
// Outputs:
//   - assets/icons/<name>.png — committed for repo browsing + README screenshots
//   - src/icons-data.ts — generated runtime source: each PNG embedded as base64
//     so esbuild can bundle them into main.js (companion-module-build bundles to
//     a single file; loose asset files don't survive the bundle).
//
// Run on demand: `yarn build:icons`. Committed outputs only need refreshing
// when the visual style changes.
//
// ⚠️  WARNING — this is NOT the generator that produced the icons currently
// committed. Those came from `slice-icon-grid.mjs` (see the header of
// src/icons-data.ts), sliced out of a hand-made grid image, and they do NOT
// match the SVG sources below: re-running this script rewrites EVERY icon and
// visibly downgrades the set (verified — thousands of pixels differ per icon,
// not antialiasing noise). Until the SVGs here are brought back in line with
// the grid artwork, do not run this to change one icon. Render the single icon
// you want and patch just its entry in src/icons-data.ts instead.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const HERE = dirname(fileURLToPath(import.meta.url))
const PNG_DIR = resolve(HERE, '..', 'assets', 'icons')
const DATA_OUT = resolve(HERE, '..', 'src', 'icons-data.ts')
const SIZE = 144

const ICONS = {
	'record-dot': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <circle cx="72" cy="72" r="38" fill="#dc1e1e"/>
</svg>`,

	stop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <rect x="32" y="32" width="80" height="80" rx="6" fill="#9c9c9c"/>
</svg>`,

	play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <polygon points="40,28 40,116 116,72" fill="#1eb43c"/>
</svg>`,

	pause: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <rect x="40" y="32" width="22" height="80" rx="3" fill="#dca01e"/>
  <rect x="82" y="32" width="22" height="80" rx="3" fill="#dca01e"/>
</svg>`,

	toggle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <polygon points="32,42 32,102 80,72" fill="#1eb43c"/>
  <rect x="90" y="42" width="14" height="60" rx="2" fill="#dca01e"/>
  <rect x="112" y="42" width="14" height="60" rx="2" fill="#dca01e"/>
</svg>`,

	next: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <polygon points="22,32 22,112 72,72" fill="#c8c8c8"/>
  <polygon points="62,32 62,112 112,72" fill="#c8c8c8"/>
  <rect x="116" y="32" width="6" height="80" fill="#c8c8c8"/>
</svg>`,

	prev: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <rect x="22" y="32" width="6" height="80" fill="#c8c8c8"/>
  <polygon points="32,72 82,32 82,112" fill="#c8c8c8"/>
  <polygon points="72,72 122,32 122,112" fill="#c8c8c8"/>
</svg>`,

	theatre: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <rect x="14" y="34" width="116" height="76" rx="4" fill="none" stroke="#dc6e1e" stroke-width="5"/>
  <rect x="40" y="56" width="64" height="32" rx="2" fill="#dc6e1e"/>
</svg>`,

	fullscreen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144" stroke="#dc3c8c" stroke-width="7" fill="none" stroke-linecap="square">
  <path d="M 22 54 L 22 22 L 54 22"/>
  <path d="M 90 22 L 122 22 L 122 54"/>
  <path d="M 122 90 L 122 122 L 90 122"/>
  <path d="M 54 122 L 22 122 L 22 90"/>
</svg>`,

	mix: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <circle cx="72" cy="72" r="46" fill="none" stroke="#14b4c8" stroke-width="9"/>
  <path d="M 72 26 A 46 46 0 0 0 72 118 Z" fill="#14b4c8"/>
  <path d="M 72 26 A 46 46 0 0 1 72 118 Z" fill="#14b4c8" opacity="0.3"/>
</svg>`,

	camera: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <rect x="14" y="44" width="116" height="68" rx="8" fill="#2864b4"/>
  <rect x="44" y="32" width="40" height="20" rx="3" fill="#2864b4"/>
  <circle cx="72" cy="78" r="22" fill="#0a3470" stroke="#5096dc" stroke-width="3"/>
  <circle cx="72" cy="78" r="10" fill="#5096dc"/>
  <rect x="100" y="56" width="10" height="6" rx="1" fill="#dc1e1e"/>
</svg>`,

	cuesheet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
  <rect x="20" y="18" width="104" height="108" rx="6" fill="#785ac8" stroke="#a08adc" stroke-width="2"/>
  <line x1="34" y1="44" x2="110" y2="44" stroke="#ffffff" stroke-width="3"/>
  <line x1="34" y1="64" x2="110" y2="64" stroke="#ffffff" stroke-width="3" opacity="0.75"/>
  <line x1="34" y1="84" x2="110" y2="84" stroke="#ffffff" stroke-width="3" opacity="0.55"/>
  <line x1="34" y1="104" x2="86" y2="104" stroke="#ffffff" stroke-width="3" opacity="0.4"/>
</svg>`,
}

async function main() {
	await mkdir(PNG_DIR, { recursive: true })
	const dataEntries = []

	const entries = Object.entries(ICONS)
	for (const [name, svg] of entries) {
		const buf = await sharp(Buffer.from(svg, 'utf8'))
			.resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.png({ compressionLevel: 9 })
			.toBuffer()
		await writeFile(join(PNG_DIR, `${name}.png`), buf)
		const b64 = buf.toString('base64')
		dataEntries.push(`\t'${name}': '${b64}',`)

		console.log(`  ${name}.png (${buf.length} bytes)`)
	}

	const dataSource =
		`// AUTO-GENERATED by scripts/build-icons.mjs — do not edit by hand.\n` +
		`// Run \`yarn build:icons\` to regenerate from the SVG sources.\n\n` +
		`export const ICON_PNG_BASE64: Record<string, string> = {\n` +
		dataEntries.join('\n') +
		`\n}\n`
	await writeFile(DATA_OUT, dataSource, 'utf8')

	console.log(`\nWrote ${entries.length} PNGs to ${PNG_DIR}`)

	console.log(`Wrote ${DATA_OUT}`)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
