import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
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

await mkdir(distRoot, { recursive: true })

const seen = new Set()
const exports = []

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
          'convertShapeToPath',
          'convertPathData',
          'removeDimensions',
        ],
      }).data

      const pathData = extractPathData(optimizedSvg)
      exports.push({ name: iconName, pathData })
    }
  }
}

exports.sort((a, b) => a.name.localeCompare(b.name))

await writeFile(
  path.join(distRoot, 'index.js'),
  exports.map(({ name, pathData }) => `export const ${name} = ${JSON.stringify(pathData)}`).join('\n') + '\n',
  'utf8',
)

await writeFile(
  path.join(distRoot, 'index.d.ts'),
  exports.map(({ name }) => `export declare const ${name}: string`).join('\n') + '\n',
  'utf8',
)

await writeFile(
  path.join(distRoot, 'index.cjs'),
  exports.map(({ name, pathData }) => `exports.${name} = ${JSON.stringify(pathData)}`).join('\n') + '\n',
  'utf8',
)

console.log(`Generated ${exports.length} path exports into dist/`)

function extractPathData(svg) {
  const matches = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*>/g)]
  const filtered = matches
    .filter((match) => !/fill="none"/.test(match[0]))
    .map((match) => match[1])
    .filter((d) => !isCanvasPath(d))
  return filtered.join(' ')
}

function isCanvasPath(d) {
  return d === 'M0 0h24v24H0z' || d === 'M0 0h24v24H0V0z' || d === 'M0 0h24v24H0zm' || d === 'M.21.16h24v24h-24z'
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
