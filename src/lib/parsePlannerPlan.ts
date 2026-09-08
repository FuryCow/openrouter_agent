export interface ApprovedPlanStep {
  order: number
  text: string
}

export interface ApprovedPlan {
  raw: string
  goal?: string
  steps: ApprovedPlanStep[]
  files: string[]
  verificationSteps: string[]
}

const SECTION_ALIASES: Record<'goal' | 'steps' | 'files' | 'verification', RegExp[]> = {
  goal: [/^goal\b/i, /^цель\b/i, /^assumptions\b/i],
  steps: [/^steps\b/i, /^plan\b/i, /^шаги\b/i, /^execution\b/i],
  files: [/^files to touch\b/i, /^files\b/i, /^файлы\b/i],
  verification: [/^testing\b/i, /^verification\b/i, /^verify\b/i, /^risks\b/i, /^проверка\b/i]
}

function normalizeHeading(line: string): string {
  return line.replace(/^#+\s*/, '').trim()
}

function classifySection(heading: string): keyof typeof SECTION_ALIASES | null {
  for (const [key, patterns] of Object.entries(SECTION_ALIASES) as Array<
    [keyof typeof SECTION_ALIASES, RegExp[]]
  >) {
    if (patterns.some((pattern) => pattern.test(heading))) return key
  }
  return null
}

function extractBacktickPaths(text: string): string[] {
  const paths = new Set<string>()
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const value = match[1]?.trim()
    if (value && (value.includes('/') || value.includes('\\') || value.includes('.'))) {
      paths.add(value)
    }
  }
  return [...paths]
}

function parseNumberedSteps(lines: string[]): ApprovedPlanStep[] {
  const steps: ApprovedPlanStep[] = []
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)[.)]\s+(.+)$/)
    if (!match) continue
    steps.push({ order: Number(match[1]), text: match[2].trim() })
  }
  return steps.sort((a, b) => a.order - b.order)
}

function parseBulletLines(lines: string[]): string[] {
  return lines
    .map((line) => line.match(/^\s*[-*•]\s+(.+)$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line))
}

export function parsePlannerPlan(raw: string): ApprovedPlan {
  const trimmed = raw.trim()
  const lines = trimmed.split('\n')

  let currentSection: keyof typeof SECTION_ALIASES | 'other' = 'other'
  const sectionLines: Record<string, string[]> = {
    goal: [],
    steps: [],
    files: [],
    verification: [],
    other: []
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/)
    if (headingMatch) {
      currentSection = classifySection(normalizeHeading(headingMatch[1])) ?? 'other'
      continue
    }
    sectionLines[currentSection].push(line)
  }

  const stepsFromSection = parseNumberedSteps(sectionLines.steps)
  const stepsFromAll = stepsFromSection.length > 0 ? stepsFromSection : parseNumberedSteps(lines)

  const files = [
    ...new Set([
      ...parseBulletLines(sectionLines.files).flatMap(extractBacktickPaths),
      ...parseBulletLines(sectionLines.files),
      ...stepsFromAll.flatMap((step) => extractBacktickPaths(step.text))
    ])
  ].filter(Boolean)

  const verificationSteps = [
    ...parseBulletLines(sectionLines.verification),
    ...parseNumberedSteps(sectionLines.verification).map((step) => step.text)
  ].filter(Boolean)

  const goal =
    sectionLines.goal
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim() || undefined

  return {
    raw: trimmed,
    goal,
    steps: stepsFromAll,
    files,
    verificationSteps
  }
}

export function formatApprovedPlanForPrompt(plan: ApprovedPlan): string {
  const parts: string[] = [
    'Executing approved planner handoff.',
    'Follow steps in order. Do not skip verification.',
    'Use update_task_checklist as you complete steps when a checklist exists.'
  ]

  if (plan.goal) {
    parts.push('', `Goal:\n${plan.goal}`)
  }

  if (plan.steps.length > 0) {
    parts.push(
      '',
      'Steps:',
      ...plan.steps.map((step) => `${step.order}. ${step.text}`)
    )
  }

  if (plan.files.length > 0) {
    parts.push('', `Files to touch:\n${plan.files.map((file) => `- ${file}`).join('\n')}`)
  }

  if (plan.verificationSteps.length > 0) {
    parts.push(
      '',
      'Verification (required before finishing):',
      ...plan.verificationSteps.map((step) => `- ${step}`)
    )
  }

  return parts.join('\n')
}
