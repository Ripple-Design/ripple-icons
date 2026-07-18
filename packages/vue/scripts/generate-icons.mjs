import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(packageRoot, '..', '..')
const sourceRoot = path.resolve(repoRoot, 'src')
const outputRoot = path.resolve(packageRoot, 'src', 'components')
const outputIndex = path.join(outputRoot, 'index.ts')

const STYLE_SUFFIX = {
  filled: 'Filled',
  outlined: 'Outlined',
  rounded: 'Rounded',
  sharp: 'Sharp',
  twotone: 'TwoTone',
}

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })

const seen = new Set()
const generated = []

for (const category of await getDirectories(sourceRoot)) {
  const categoryDir = path.join(sourceRoot, category)

  for (const icon of await getDirectories(categoryDir)) {
    const iconDir = path.join(categoryDir, icon)

    for (const file of await readdir(iconDir, { withFileTypes: true })) {
      if (!file.isFile() || path.extname(file.name) !== '.svg') {
        continue
      }

      const style = path.basename(file.name, '.svg')
      const suffix = STYLE_SUFFIX[style]
      if (!suffix) {
        continue
      }

      const componentName = `RI${toPascalCase(icon)}${suffix}`
      const lower = componentName.toLowerCase()
      if (seen.has(lower)) {
        continue
      }
      seen.add(lower)

      const svgSource = await readFile(path.join(iconDir, file.name), 'utf8')
      const vueSfc = buildVueSfc(componentName, svgSource)

      await writeFile(path.join(outputRoot, `${componentName}.vue`), vueSfc, 'utf8')
      generated.push(componentName)
    }
  }
}

generated.sort((a, b) => a.localeCompare(b))

await writeFile(
  outputIndex,
  generated.map((name) => `export { default as ${name} } from './${name}.vue'`).join('\n') + '\n',
  'utf8',
)

console.log(`Generated ${generated.length} Vue icon components.`)

function buildVueSfc(componentName, svgSource) {
  const normalizedSvg = svgSource
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .trim()

  return `<template>
${normalizedSvg}
</template>

<script setup lang="ts">
defineOptions({
  name: ${JSON.stringify(componentName)},
  inheritAttrs: false,
})
</script>
`
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
