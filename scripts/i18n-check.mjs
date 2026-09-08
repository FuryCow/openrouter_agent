import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOCALES_DIR = join(ROOT, 'src/i18n/locales/en')
const SRC_DIR = join(ROOT, 'src')

function flattenKeys(obj, prefix = '') {
  const keys = new Set()
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const child of flattenKeys(value, next)) {
        keys.add(child)
      }
    } else {
      keys.add(next)
    }
  }
  return keys
}

function loadLocaleKeys() {
  const byNs = new Map()
  for (const file of readdirSync(LOCALES_DIR)) {
    if (!file.endsWith('.json')) continue
    const ns = file.replace(/\.json$/, '')
    const json = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf-8'))
    byNs.set(ns, flattenKeys(json))
  }
  return byNs
}

function walkFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'locales') continue
      walkFiles(full, acc)
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.endsWith('.test.ts')) {
      acc.push(full)
    }
  }
  return acc
}

function extractAliasNamespaces(source) {
  const aliases = new Map()

  const useTranslationRe =
    /(?:const|let)\s*\{\s*([^}]+)\s*\}\s*=\s*useTranslation\(\s*['"]([^'"]+)['"]\s*\)/g
  let match
  while ((match = useTranslationRe.exec(source)) !== null) {
    const bindings = match[1]
    const ns = match[2]
    for (const part of bindings.split(',')) {
      const trimmed = part.trim()
      const rename = trimmed.match(/^t\s*:\s*(\w+)$/)
      if (rename) {
        aliases.set(rename[1], ns)
      } else if (trimmed === 't') {
        aliases.set('t', ns)
      }
    }
  }

  const getTRe = /(?:const|let)\s+(\w+)\s*=\s*getT\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = getTRe.exec(source)) !== null) {
    aliases.set(match[1], match[2])
  }

  return aliases
}

function checkKey(localeKeys, ns, key, rel, missing) {
  const keys = localeKeys.get(ns)
  if (keys && !keys.has(key)) {
    missing.add(`${rel}: ${ns}.${key}`)
  }
}

function main() {
  const localeKeys = loadLocaleKeys()
  const files = walkFiles(SRC_DIR)
  const missing = new Set()

  for (const file of files) {
    const source = readFileSync(file, 'utf-8')
    const rel = relative(ROOT, file)
    const aliases = extractAliasNamespaces(source)

    for (const [alias, ns] of aliases.entries()) {
      const re = new RegExp(`\\b${alias}\\(\\s*['"]([^'"]+)['"]`, 'g')
      let match
      while ((match = re.exec(source)) !== null) {
        checkKey(localeKeys, ns, match[1], rel, missing)
      }
    }
  }

  if (missing.size > 0) {
    console.error('Missing i18n keys:')
    for (const line of [...missing].sort()) {
      console.error(`  - ${line}`)
    }
    process.exit(1)
  }

  console.log(`i18n check OK (${localeKeys.size} namespaces)`)
}

main()
