import { execSync } from 'node:child_process'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'
import vue from 'rollup-plugin-vue'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const componentsRoot = path.resolve(packageRoot, 'src', 'components')
const distRoot = path.resolve(packageRoot, 'dist')

// ---- 1. Clean dist ----
await rm(distRoot, { recursive: true, force: true })
await mkdir(distRoot, { recursive: true })

// ---- 2. Generate .d.ts via vue-tsc ----
console.log('[1/4] Generating type declarations via vue-tsc...')
execSync('npx vue-tsc --project tsconfig.build.json', {
  cwd: packageRoot,
  stdio: 'inherit',
})

// vue-tsc outputs .d.ts under dist/components/, move them up to dist/
// Also rename *.vue.d.ts → *.d.ts
try {
  const nestedDir = path.join(distRoot, 'components')
  const entries = await readdir(nestedDir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.d.ts')) {
      const { rename } = await import('node:fs/promises')
      const src = path.join(nestedDir, e.name)
      // RI10kFilled.vue.d.ts → RI10kFilled.d.ts
      const destName = e.name.replace('.vue.d.ts', '.d.ts')
      await rename(src, path.join(distRoot, destName))
    }
  }
  await rm(nestedDir, { recursive: true, force: true })
  console.log('  Moved .d.ts from dist/components/ to dist/')
} catch {
  // no nested dir — .d.ts are already in the right place
}

// ---- 3. Collect component names ----
const names = []
for (const entry of await readdir(componentsRoot, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  if (entry.name.endsWith('.vue')) {
    names.push(path.basename(entry.name, '.vue'))
  }
}
names.sort((a, b) => a.localeCompare(b))
console.log(`  Found ${names.length} icon components`)

// ---- 4. Bundle with vite (main entries) + rolldown (per-icon sub-path exports) ----

// 4a. vite build for index + global entries
console.log('[2/4] Bundling main entries with vite...')
execSync('npx vite build', {
  cwd: packageRoot,
  stdio: 'inherit',
})

// 4b. rolldown for per-component sub-path exports (./RI10kFilled etc.)
console.log('[3/4] Building per-component entries with rolldown...')
const rolldownConfig = {
  plugins: [vue()],
  external: ['vue'],
}

let done = 0
const batchSize = 50

for (let i = 0; i < names.length; i += batchSize) {
  const batch = names.slice(i, i + batchSize)
  await Promise.all(
    batch.map(async (name) => {
      const bundle = await rolldown({
        ...rolldownConfig,
        input: path.join(componentsRoot, `${name}.vue`),
      })
      await bundle.write({ format: 'esm', file: path.join(distRoot, `${name}.js`) })
      await bundle.write({ format: 'cjs', file: path.join(distRoot, `${name}.cjs`) })
      await bundle.close()
    }),
  )
  done += batch.length
  process.stdout.write(`\r  ${done}/${names.length}`)
}
console.log()

// ---- 5. Barrel files ----
console.log('[4/4] Writing barrel files...')
await writeFile(
  path.join(distRoot, 'index.d.ts'),
  names.map((n) => `export { default as ${n} } from './${n}.js'`).join('\n') + '\n',
  'utf8',
)

await writeFile(
  path.join(distRoot, 'index.mjs'),
  names.map((n) => `export { default as ${n} } from './${n}.js'`).join('\n') + '\n',
  'utf8',
)

console.log(`\nDone! Built ${names.length} icon components into dist/.`)
