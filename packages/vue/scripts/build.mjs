import { readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const componentsRoot = path.resolve(packageRoot, 'src', 'components')
const distRoot = path.resolve(packageRoot, 'dist')

// ---- 1. Clean dist ----
await rm(distRoot, { recursive: true, force: true })

// ---- 2. Collect component names ----
const names = []
for (const entry of await readdir(componentsRoot, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  if (entry.name.endsWith('.vue')) {
    names.push(path.basename(entry.name, '.vue'))
  }
}
names.sort((a, b) => a.localeCompare(b))
console.log(`  Found ${names.length} icon components`)

// ---- 3. Bundle with vite ----
console.log('[1/2] Bundling with vite...')
execSync('npx vite build', {
  cwd: packageRoot,
  stdio: 'inherit',
})

// ---- 4. Write index.d.ts ----
console.log('[2/2] Writing index.d.ts...')
await writeFile(
  path.join(distRoot, 'index.d.ts'),
  names.map((n) => `export { default as ${n} } from './index.js'`).join('\n') + '\n',
  'utf8',
)

console.log(`\nDone! dist/: index.js, index.cjs, index.d.ts`)
