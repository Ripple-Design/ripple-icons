import { execSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const distRoot = path.resolve(packageRoot, 'dist')

// ---- 1. Clean dist ----
await rm(distRoot, { recursive: true, force: true })
await mkdir(distRoot, { recursive: true })

// ---- 2. Generate .d.ts via vue-tsc ----
console.log('[1/2] Generating type declarations via vue-tsc...')
execSync('npx vue-tsc --project tsconfig.build.json', {
  cwd: packageRoot,
  stdio: 'inherit',
})

// ---- 3. Bundle with vite (index + global entries) ----
console.log('[2/2] Bundling with vite...')
execSync('npx vite build', {
  cwd: packageRoot,
  stdio: 'inherit',
})

console.log('\nDone!')
