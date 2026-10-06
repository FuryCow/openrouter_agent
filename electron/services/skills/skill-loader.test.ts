import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  SkillLoader,
  parseFrontmatter,
  getProjectSkillsDir,
  SKILL_FILE_NAME,
  SKILL_NAME_PATTERN
} from './skill-loader'

let tmpRoot: string
let globalDir: string
let workspace: string

async function createSkill(
  root: string,
  name: string,
  frontmatter: string,
  body = 'Do the thing.'
): Promise<string> {
  const dir = join(root, name)
  await mkdir(dir, { recursive: true })
  const skillPath = join(dir, SKILL_FILE_NAME)
  await writeFile(skillPath, `---\n${frontmatter}\n---\n${body}`, 'utf-8')
  return skillPath
}

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'ora-skills-'))
  globalDir = join(tmpRoot, 'global-skills')
  workspace = join(tmpRoot, 'workspace')
  await mkdir(globalDir, { recursive: true })
  await mkdir(workspace, { recursive: true })
})

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true })
})

describe('parseFrontmatter', () => {
  it('parses key/value pairs and keeps the body', () => {
    const parsed = parseFrontmatter('---\nname: react-refactor\ndescription: Refactor guide\n---\n# Body')
    expect(parsed).not.toBeNull()
    expect(parsed?.fields.name).toBe('react-refactor')
    expect(parsed?.fields.description).toBe('Refactor guide')
    expect(parsed?.body).toBe('# Body')
  })

  it('returns null without frontmatter', () => {
    expect(parseFrontmatter('# just markdown')).toBeNull()
  })

  it('ignores values without a key', () => {
    const parsed = parseFrontmatter('---\njust a line\nname: ok\n---\nbody')
    expect(parsed?.fields.name).toBe('ok')
    expect(Object.keys(parsed?.fields ?? {})).toEqual(['name'])
  })
})

describe('SkillLoader.listSkills', () => {
  it('returns [] when no skill directories exist', async () => {
    const loader = new SkillLoader(join(tmpRoot, 'missing'))
    expect(await loader.listSkills()).toEqual([])
    expect(await loader.listSkills(workspace)).toEqual([])
  })

  it('lists global skills with frontmatter name and description', async () => {
    await createSkill(globalDir, 'react-refactor', 'name: react-refactor\ndescription: How to refactor React components.')
    const loader = new SkillLoader(globalDir)
    const skills = await loader.listSkills()
    expect(skills).toHaveLength(1)
    expect(skills[0]).toMatchObject({
      name: 'react-refactor',
      description: 'How to refactor React components.',
      source: 'global'
    })
    expect(skills[0].path.endsWith(SKILL_FILE_NAME)).toBe(true)
  })

  it('falls back to the directory name when frontmatter has no name', async () => {
    await createSkill(globalDir, 'dir-named', 'description: Something useful.')
    const loader = new SkillLoader(globalDir)
    const skills = await loader.listSkills()
    expect(skills[0].name).toBe('dir-named')
  })

  it('skips skills with invalid names or missing description', async () => {
    await createSkill(globalDir, 'bad_name', 'name: bad_name\ndescription: underscore')
    await createSkill(globalDir, 'no-desc', 'name: no-desc')
    await createSkill(globalDir, 'good-one', 'name: good-one\ndescription: Fine')
    const loader = new SkillLoader(globalDir)
    const skills = await loader.listSkills()
    expect(skills.map((s) => s.name)).toEqual(['good-one'])
  })

  it('skips directories that are not valid skill names', async () => {
    await createSkill(globalDir, 'Not_Valid', 'name: ok\ndescription: dir invalid')
    const loader = new SkillLoader(globalDir)
    expect(await loader.listSkills()).toEqual([])
  })

  it('merges project skills over global skills with the same name', async () => {
    await createSkill(globalDir, 'deploy', 'name: deploy\ndescription: Global deploy guide.')
    await createSkill(globalDir, 'lint', 'name: lint\ndescription: Global lint guide.')
    const projectDir = getProjectSkillsDir(workspace)
    await createSkill(projectDir, 'deploy', 'name: deploy\ndescription: Project deploy guide.')

    const loader = new SkillLoader(globalDir)
    const skills = await loader.listSkills(workspace)
    expect(skills).toHaveLength(2)
    const deploy = skills.find((s) => s.name === 'deploy')
    expect(deploy).toMatchObject({ description: 'Project deploy guide.', source: 'project' })
    expect(skills.find((s) => s.name === 'lint')?.source).toBe('global')
  })

  it('does not treat a SKILL.md without frontmatter as a skill', async () => {
    const dir = join(globalDir, 'raw')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, SKILL_FILE_NAME), '# no frontmatter', 'utf-8')
    const loader = new SkillLoader(globalDir)
    expect(await loader.listSkills()).toEqual([])
  })
})

describe('SkillLoader.readSkill', () => {
  it('reads the full skill file', async () => {
    const path = await createSkill(globalDir, 'reader', 'name: reader\ndescription: Read me', 'Step 1. Do it.')
    const loader = new SkillLoader(globalDir)
    await loader.listSkills()
    expect(await loader.readSkill(path)).toContain('Step 1. Do it.')
  })

  it('rejects paths outside the skills directories', async () => {
    const outside = join(tmpRoot, 'outside.md')
    await writeFile(outside, 'secret', 'utf-8')
    const loader = new SkillLoader(globalDir)
    await expect(loader.readSkill(outside)).rejects.toThrow('outside skills directories')
  })

  it('allows project skills only after the workspace is bound by listSkills', async () => {
    const projectDir = getProjectSkillsDir(workspace)
    const path = await createSkill(projectDir, 'project-only', 'name: project-only\ndescription: Local')
    const loader = new SkillLoader(globalDir)
    await expect(loader.readSkill(path)).rejects.toThrow('outside skills directories')
    await loader.listSkills(workspace)
    expect(await loader.readSkill(path)).toContain('Local')
  })

  it('resolves a bare skill name or root-relative path across roots', async () => {
    await createSkill(globalDir, 'named', 'name: named\ndescription: Named', 'Body A')
    await createSkill(
      getProjectSkillsDir(workspace),
      'proj-skill',
      'name: proj-skill\ndescription: Project',
      'Body B'
    )
    const loader = new SkillLoader(globalDir)
    await loader.listSkills(workspace)

    expect(await loader.readSkill('named')).toContain('Body A')
    expect(await loader.readSkill('named/SKILL.md')).toContain('Body A')
    expect(await loader.readSkill('proj-skill')).toContain('Body B')
    await expect(loader.readSkill('../escape')).rejects.toThrow('outside skills directories')
    await expect(loader.readSkill('missing-skill')).rejects.toThrow('Skill file not found')
  })
})

describe('SkillLoader.saveSkill', () => {
  it('writes <workspace>/.openrouter/skills/<name>/SKILL.md', async () => {
    const loader = new SkillLoader(globalDir)
    const target = await loader.saveSkill(workspace, 'new-skill', '---\nname: new-skill\ndescription: x\n---\nbody')
    expect(target).toBe(join(getProjectSkillsDir(workspace), 'new-skill', SKILL_FILE_NAME))
    const saved = await readFile(target, 'utf-8')
    expect(saved).toContain('name: new-skill')
  })

  it('rejects invalid names including traversal attempts', async () => {
    const loader = new SkillLoader(globalDir)
    await expect(loader.saveSkill(workspace, '../evil', 'x')).rejects.toThrow('Invalid skill name')
    await expect(loader.saveSkill(workspace, 'Bad_Name', 'x')).rejects.toThrow('Invalid skill name')
    await expect(loader.saveSkill(workspace, '', 'x')).rejects.toThrow('Invalid skill name')
  })
})

describe('SkillLoader.deleteSkill', () => {
  it('deletes the skill folder', async () => {
    const path = await createSkill(getProjectSkillsDir(workspace), 'doomed', 'name: doomed\ndescription: bye')
    const loader = new SkillLoader(globalDir)
    await loader.listSkills(workspace)
    await loader.deleteSkill(path)
    await expect(readFile(path, 'utf-8')).rejects.toThrow()
  })

  it('refuses to delete a skills root directory', async () => {
    const loader = new SkillLoader(globalDir)
    await loader.listSkills(workspace)
    await expect(loader.deleteSkill(join(globalDir, SKILL_FILE_NAME))).rejects.toThrow(
      'Refusing to delete skills root'
    )
  })

  it('rejects paths outside the skills directories', async () => {
    const outside = join(tmpRoot, 'not-skills', 'skill.md')
    await mkdir(join(tmpRoot, 'not-skills'), { recursive: true })
    await writeFile(outside, 'x', 'utf-8')
    const loader = new SkillLoader(globalDir)
    await expect(loader.deleteSkill(outside)).rejects.toThrow('outside skills directories')
  })
})

describe('SKILL_NAME_PATTERN', () => {
  it('accepts lowercase names, digits, and dashes', () => {
    expect(SKILL_NAME_PATTERN.test('react-refactor')).toBe(true)
    expect(SKILL_NAME_PATTERN.test('a')).toBe(true)
    expect(SKILL_NAME_PATTERN.test('v2-migration')).toBe(true)
    expect(SKILL_NAME_PATTERN.test('Bad')).toBe(false)
    expect(SKILL_NAME_PATTERN.test('has space')).toBe(false)
    expect(SKILL_NAME_PATTERN.test('../etc')).toBe(false)
    expect(SKILL_NAME_PATTERN.test('')).toBe(false)
    expect(SKILL_NAME_PATTERN.test('a'.repeat(65))).toBe(false)
  })
})
