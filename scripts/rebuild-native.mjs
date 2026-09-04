import { rebuild } from '@electron/rebuild'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const projectRoot = join(import.meta.dirname, '..')
const electronVersion = require('electron/package.json').version

const modules = ['better-sqlite3', 'hnswlib-node']

for (const name of modules) {
  const prebuildsDir = join(projectRoot, 'node_modules', name, 'prebuilds')
  if (existsSync(prebuildsDir)) {
    for (const file of ['win32-x64.node', 'win32-arm64.node']) {
      const filePath = join(prebuildsDir, file)
      if (existsSync(filePath)) rmSync(filePath)
    }
  }
}

await rebuild({
  buildPath: projectRoot,
  electronVersion,
  force: true,
  onlyModules: modules,
  buildFromSource: true,
  disablePreGypCopy: true
})

console.log(`[postinstall] Rebuilt native modules for Electron ${electronVersion}: ${modules.join(', ')}`)
