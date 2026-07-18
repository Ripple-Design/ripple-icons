import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const distRoot = path.resolve(packageRoot, 'dist')

// Keep dist/ intact; generate-icons.mjs writes the publishable files directly.
await mkdir(distRoot, { recursive: true })

console.log('dist/ is prepared by generate-icons.mjs')
