import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimize } from 'svgo'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const sourceRoot = path.resolve(repoRoot, 'src')
const distRoot = path.resolve(packageRoot, 'dist')

const STYLE_SUFFIX = {
  filled: 'Filled',
  outlined: 'Outlined',
  rounded: 'Rounded',
  sharp: 'Sharp',
  twotone: 'TwoTone',
}

const STYLES = Object.keys(STYLE_SUFFIX)

await rm(distRoot, { recursive: true, force: true })
await mkdir(distRoot, { recursive: true })

const seen = new Set()
const icons = []

for (const category of await getDirectories(sourceRoot)) {
  const categoryDir = path.join(sourceRoot, category)

  for (const icon of await getDirectories(categoryDir)) {
    const iconDir = path.join(categoryDir, icon)

    for (const file of await readdir(iconDir, { withFileTypes: true })) {
      if (!file.isFile() || path.extname(file.name) !== '.svg') continue

      const style = path.basename(file.name, '.svg')
      const suffix = STYLE_SUFFIX[style]
      if (!suffix) continue

      const iconName = `RI${toPascalCase(icon)}${suffix}`
      const key = iconName.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const rawSvg = await readFile(path.join(iconDir, file.name), 'utf8')
      const optimizedSvg = optimize(rawSvg, {
        multipass: true,
        plugins: [
          'preset-default',
          'removeDimensions',
        ],
      }).data

      icons.push({ name: iconName, style, slug: icon, svg: optimizedSvg })
    }
  }
}

icons.sort((a, b) => a.name.localeCompare(b.name))

const rootLines = []
const allLines = []
const styleLines = Object.fromEntries(STYLES.map((style) => [style, []]))
const files = []

for (const { name, style, slug, svg } of icons) {
  rootLines.push(`export { ${name} } from "./${style}/${slug}.js"`)
  allLines.push(`export { ${name} } from "./${style}/${slug}.js"`)
  styleLines[style].push(`export { ${name} } from "./${slug}.js"`)

  files.push([
    path.join(distRoot, style, `${slug}.js`),
    `export const ${name} = ${JSON.stringify(svg)}\n`,
  ])
  files.push([
    path.join(distRoot, style, `${slug}.d.ts`),
    `import type { RIIcon } from "../types.js"\nexport declare const ${name}: RIIcon\n`,
  ])
}

files.push([
  path.join(distRoot, 'types.d.ts'),
  'export type RIIcon = string & { readonly __riIconBrand: unique symbol }\n',
])

files.push([
  path.join(distRoot, 'index.js'),
  rootLines.join('\n') + '\n',
])
files.push([
  path.join(distRoot, 'index.d.ts'),
  `export type { RIIcon } from "./types.js"\n\n${rootLines.join('\n')}\n`,
])
files.push([
  path.join(distRoot, 'index.cjs'),
  icons.map(({ name, svg }) => `exports.${name} = ${JSON.stringify(svg)}`).join('\n') + '\n',
])

// The "all" entry must be its own module (not a re-export of index.js) so that a
// namespace import of it does not get merged with the root barrel's static imports.
files.push([
  path.join(distRoot, 'all.js'),
  allLines.join('\n') + '\n',
])
files.push([
  path.join(distRoot, 'all.d.ts'),
  `export type { RIIcon } from "./types.js"\n\n${allLines.join('\n')}\n`,
])

for (const style of STYLES) {
  await mkdir(path.join(distRoot, style), { recursive: true })

  files.push([
    path.join(distRoot, style, 'index.js'),
    styleLines[style].join('\n') + '\n',
  ])
  files.push([
    path.join(distRoot, style, 'index.d.ts'),
    styleLines[style].join('\n') + '\n',
  ])
}

await writeBatches(files, 256)

console.log(`Generated ${icons.length} optimized SVG exports into dist/`)
console.log(`Wrote ${files.length} files (per-icon modules, style barrels, root/all barrels)`)

async function writeBatches(entries, batchSize) {
  for (let index = 0; index < entries.length; index += batchSize) {
    await Promise.all(
      entries.slice(index, index + batchSize).map(([file, content]) => writeFile(file, content, 'utf8')),
    )
  }
}

function toPascalCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

async function getDirectories(root) {
  const entries = await readdir(root, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}
