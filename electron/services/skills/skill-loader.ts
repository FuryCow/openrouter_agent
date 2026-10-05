import { homedir } from 'os'
import { join, dirname } from 'path'
import { readdir, readFile, writeFile, mkdir, rm, access } from 'fs/promises'
import type { SkillInfo } from '../../types'
import { assertPathNotInAgentApp, isPathInside } from '../workspace-safety'

export type { SkillInfo } from '../../types'

export const SKILL_FILE_NAME = 'SKILL.md'
export const MAX_PROMPT_SKILLS = 20
export const MAX_DESCRIPTION_CHARS = 200

/** Skill names double as directory names — keep them traversal-proof. */
export const SKILL_NAME_PATTERN = /^[a-z0-9-]{1,64}$/

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseFrontmatter(
  raw: string
): { fields: Record<string, string>; body: string } | null {
  const match = FRONTMATTER_RE.exec(raw)
  if (!match) return null
  const fields: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key) fields[key] = value
  }
  return { fields, body: raw.slice(match[0].length) }
}

export function getProjectSkillsDir(workspaceDir: string): string {
  return join(workspaceDir, '.openrouter', 'skills')
}

export function getGlobalSkillsDir(): string {
  return join(homedir(), '.openrouter_agent', 'skills')
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function scanSkillsDir(dir: string, source: SkillInfo['source']): Promise<SkillInfo[]> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }

  const skills: SkillInfo[] = []
  for (const name of names) {
    if (!SKILL_NAME_PATTERN.test(name)) continue
    const skillPath = join(dir, name, SKILL_FILE_NAME)
    if (!(await fileExists(skillPath))) continue

    let raw = ''
    try {
      raw = await readFile(skillPath, 'utf-8')
    } catch (err) {
      console.warn(`[Skills] Failed to read ${skillPath}:`, err)
      continue
    }

    const parsed = parseFrontmatter(raw)
    if (!parsed) {
      console.warn(`[Skills] Skipping ${skillPath}: missing YAML frontmatter`)
      continue
    }

    const skillName = parsed.fields.name ?? name
    if (!SKILL_NAME_PATTERN.test(skillName)) {
      console.warn(`[Skills] Skipping ${skillPath}: invalid skill name "${skillName}"`)
      continue
    }
    if (!parsed.fields.description?.trim()) {
      console.warn(`[Skills] Skipping ${skillPath}: empty description`)
      continue
    }

    skills.push({
      name: skillName,
      description: parsed.fields.description.trim(),
      path: skillPath,
      source
    })
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

export class SkillLoader {
  private currentProjectDir: string | null = null

  constructor(private globalDir: string = getGlobalSkillsDir()) {}

  /** Project skills override global skills with the same name. */
  async listSkills(workspaceDir?: string): Promise<SkillInfo[]> {
    this.currentProjectDir = workspaceDir?.trim()
      ? getProjectSkillsDir(workspaceDir.trim())
      : null

    const global = await scanSkillsDir(this.globalDir, 'global')
    if (!this.currentProjectDir) return global

    const project = await scanSkillsDir(this.currentProjectDir, 'project')
    const merged = new Map(global.map((skill) => [skill.name, skill]))
    for (const skill of project) merged.set(skill.name, skill)
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  async readSkill(path: string): Promise<string> {
    this.assertSkillPath(path)
    return readFile(path, 'utf-8')
  }

  /** Writes `<workspace>/.openrouter/skills/<name>/SKILL.md` and returns the path. */
  async saveSkill(workspaceDir: string, name: string, content: string): Promise<string> {
    assertPathNotInAgentApp(workspaceDir)
    if (!SKILL_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid skill name: "${name}". Use lowercase letters, digits, and dashes (max 64).`)
    }
    const dir = getProjectSkillsDir(workspaceDir)
    const target = join(dir, name, SKILL_FILE_NAME)
    this.assertInsideDir(dir, target)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf-8')
    return target
  }

  /** Deletes the skill folder containing SKILL.md at `path`. Skills roots are protected. */
  async deleteSkill(path: string): Promise<void> {
    this.assertSkillPath(path)
    const skillDir = dirname(path)
    for (const root of this.allowedRoots()) {
      if (isPathInside(root, skillDir) && skillDir === root) {
        throw new Error(`Refusing to delete skills root directory: ${skillDir}`)
      }
    }
    await rm(skillDir, { recursive: true, force: true })
  }

  private assertSkillPath(path: string): void {
    assertPathNotInAgentApp(path)
    const allowed = this.allowedRoots()
    if (allowed.length === 0 || !allowed.some((dir) => isPathInside(dir, path))) {
      throw new Error(`Skill path is outside skills directories: ${path}`)
    }
  }

  private assertInsideDir(dir: string, target: string): void {
    assertPathNotInAgentApp(target)
    if (!isPathInside(dir, target)) {
      throw new Error(`Skill path is outside skills directories: ${target}`)
    }
  }

  /** The workspace skills dir is only known after listSkills() binds it to a run. */
  private allowedRoots(): string[] {
    return this.currentProjectDir ? [this.globalDir, this.currentProjectDir] : [this.globalDir]
  }
}
