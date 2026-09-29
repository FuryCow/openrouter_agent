export type ReasoningEffortLevel = 'auto' | 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export const REASONING_EFFORT_STEPS: ReasoningEffortLevel[] = [
  'auto',
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
]

export type ReasoningEffortApiValue =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'

export interface ReasoningRequestContext {
  mandatory?: boolean
  defaultEffort?: string
  /** From OpenRouter model.reasoning.supported_efforts */
  supportedEfforts?: string[] | null
}

const STEP_TO_API: Record<Exclude<ReasoningEffortLevel, 'auto'>, ReasoningEffortApiValue> = {
  none: 'none',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max'
}

const API_TO_LEVEL: Partial<Record<ReasoningEffortApiValue, ReasoningEffortLevel>> = {
  none: 'none',
  minimal: 'low',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max'
}

export function apiEffortToLevel(api: string | undefined): ReasoningEffortLevel | undefined {
  if (!api) return undefined
  return API_TO_LEVEL[api as ReasoningEffortApiValue]
}

export function levelToApiEffort(level: ReasoningEffortLevel): ReasoningEffortApiValue | null {
  if (level === 'auto') return null
  return STEP_TO_API[level]
}

function supportedLevelsFromApi(supportedEfforts?: string[] | null): ReasoningEffortLevel[] {
  if (!supportedEfforts?.length) return []
  const levels: ReasoningEffortLevel[] = []
  const seen = new Set<ReasoningEffortLevel>()
  for (const api of supportedEfforts) {
    const level = apiEffortToLevel(api)
    if (!level || level === 'none' || seen.has(level)) continue
    seen.add(level)
    levels.push(level)
  }
  return levels.sort(
    (a, b) => REASONING_EFFORT_STEPS.indexOf(a) - REASONING_EFFORT_STEPS.indexOf(b)
  )
}

export function getReasoningEffortSteps(context?: ReasoningRequestContext): ReasoningEffortLevel[] {
  const mandatory = context?.mandatory === true
  const apiLevels = supportedLevelsFromApi(context?.supportedEfforts)

  let steps: ReasoningEffortLevel[] = mandatory
    ? REASONING_EFFORT_STEPS.filter((step) => step !== 'none')
    : [...REASONING_EFFORT_STEPS]

  if (apiLevels.length > 0) {
    const allowed = new Set<ReasoningEffortLevel>(['auto', ...apiLevels])
    if (!mandatory) allowed.add('none')
    steps = steps.filter((step) => allowed.has(step))
  }

  return steps
}

export function normalizeReasoningEffort(value: unknown): ReasoningEffortLevel {
  if (typeof value === 'string' && REASONING_EFFORT_STEPS.includes(value as ReasoningEffortLevel)) {
    return value as ReasoningEffortLevel
  }
  return 'auto'
}

function pickNearestSupportedLevel(
  effort: ReasoningEffortLevel,
  supportedEfforts: string[]
): ReasoningEffortLevel {
  const supportedLevels = supportedLevelsFromApi(supportedEfforts)
  if (supportedLevels.length === 0) return effort
  if (effort === 'auto' || effort === 'none') return effort
  if (supportedLevels.includes(effort)) return effort

  const targetIdx = REASONING_EFFORT_STEPS.indexOf(effort)
  let best = supportedLevels[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const level of supportedLevels) {
    const distance = Math.abs(REASONING_EFFORT_STEPS.indexOf(level) - targetIdx)
    if (
      distance < bestDistance ||
      (distance === bestDistance &&
        REASONING_EFFORT_STEPS.indexOf(level) > REASONING_EFFORT_STEPS.indexOf(best))
    ) {
      bestDistance = distance
      best = level
    }
  }
  return best
}

export function clampReasoningEffortForModel(
  effort: ReasoningEffortLevel | undefined,
  context?: ReasoningRequestContext
): ReasoningEffortLevel {
  const normalized = normalizeReasoningEffort(effort)
  const steps = getReasoningEffortSteps(context)

  if (context?.mandatory && normalized === 'none') {
    return apiEffortToLevel(context.defaultEffort) ?? steps.find((s) => s !== 'auto') ?? 'medium'
  }

  if (context?.supportedEfforts?.length) {
    const mapped = pickNearestSupportedLevel(normalized, context.supportedEfforts)
    if (steps.includes(mapped)) return mapped
  }

  if (steps.includes(normalized)) return normalized

  if (context?.mandatory) {
    return apiEffortToLevel(context.defaultEffort) ?? steps.find((s) => s !== 'auto') ?? 'medium'
  }

  return normalized
}

export function resolveReasoningApiEffort(
  effort: ReasoningEffortLevel | undefined,
  context?: ReasoningRequestContext
): ReasoningEffortApiValue | null {
  const clamped = clampReasoningEffortForModel(effort, context)

  if (context?.mandatory) {
    if (clamped === 'auto') {
      const fromDefault = apiEffortToLevel(context.defaultEffort)
      if (fromDefault && fromDefault !== 'none') return fromDefault
      const first = supportedLevelsFromApi(context.supportedEfforts)[0]
      return levelToApiEffort(first ?? 'medium')
    }
    return levelToApiEffort(clamped)
  }

  if (clamped === 'auto') return null
  return levelToApiEffort(clamped)
}

export function toOpenRouterReasoningBody(
  effort: ReasoningEffortLevel | undefined,
  context?: ReasoningRequestContext
): { reasoning: { effort: ReasoningEffortApiValue } } | Record<string, never> {
  const apiEffort = resolveReasoningApiEffort(effort, context)
  if (!apiEffort) return {}
  return { reasoning: { effort: apiEffort } }
}

export function reasoningEffortStepIndex(
  effort: ReasoningEffortLevel,
  context?: ReasoningRequestContext
): number {
  const steps = getReasoningEffortSteps(context)
  const clamped = clampReasoningEffortForModel(effort, context)
  const index = steps.indexOf(clamped)
  return index >= 0 ? index : 0
}

export function reasoningEffortFromStepIndex(
  index: number,
  context?: ReasoningRequestContext
): ReasoningEffortLevel {
  const steps = getReasoningEffortSteps(context)
  const clamped = Math.max(0, Math.min(steps.length - 1, Math.round(index)))
  return steps[clamped]
}
