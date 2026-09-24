import { mkdir, readdir, writeFile } from 'fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'path'

export const PLANNER_PLANS_DIR = '.openrouter/plans'

export function looksLikePlannerPlanPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  if (normalized.includes('/../') || normalized.startsWith('../')) return false
  const marker = `${PLANNER_PLANS_DIR}/`
  const index = normalized.indexOf(marker)
  if (index < 0) return false
  const rest = normalized.slice(index + marker.length)
  return rest.endsWith('.md') && rest.length > '.md'.length && !rest.includes('..')
}

export function isPlannerPlanPath(workspacePath: string, filePath: string): boolean {
  const workspace = resolve(workspacePath)
  const absolute = isAbsolute(filePath) ? resolve(filePath) : resolve(workspace, filePath)
  const rel = relative(workspace, absolute)
  if (!rel || isAbsolute(rel) || rel.startsWith('..') || rel.split(sep)[0] === '..') return false
  return looksLikePlannerPlanPath(rel)
}

export function planFileSlug(markdown: string): string {
  const line =
    markdown
      .split('\n')
      .map((item) => item.replace(/^#+\s*/, '').trim())
      .find((item) => item.length > 0) ?? 'plan'
  const slug = line
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'plan'
}

export function uniquePlanFilename(desired: string, existing: string[]): string {
  const names = new Set(existing.map((name) => name.toLowerCase()))
  if (!names.has(desired.toLowerCase())) return desired
  const suffix = desired.toLowerCase().endsWith('.md') ? '.md' : ''
  const stem = suffix ? desired.slice(0, -suffix.length) : desired
  let n = 2
  while (names.has(`${stem}-${n}${suffix}`.toLowerCase())) n++
  return `${stem}-${n}${suffix}`
}

function planTimestamp(now = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export async function writePlannerPlan(workspacePath: string, markdown: string): Promise<string> {
  const dir = join(workspacePath, '.openrouter', 'plans')
  await mkdir(dir, { recursive: true })
  const existing = await readdir(dir).catch(() => [] as string[])
  const filename = uniquePlanFilename(`${planTimestamp()}-${planFileSlug(markdown)}.md`, existing)
  const relativePath = `${PLANNER_PLANS_DIR}/${filename}`.replace(/\\/g, '/')
  const body = `<!-- saved ${new Date().toISOString()} -->\n\n${markdown.trim()}\n`
  await writeFile(join(dir, filename), body, 'utf-8')
  return relativePath
}
