import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const distRoot = path.resolve(packageRoot, 'dist')

await rm(distRoot, { recursive: true, force: true })
await mkdir(distRoot, { recursive: true })

console.log('dist/ is prepared by generate-icons.mjs')
