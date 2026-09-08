const STEP_TEXT_KEYS = ['text', 'title', 'description', 'step', 'content', 'name'] as const

export function normalizeChecklistStepItem(item: unknown): string | null {
  if (typeof item === 'string') {
    const trimmed = item.trim()
    return trimmed || null
  }

  if (typeof item === 'number' || typeof item === 'boolean') {
    const trimmed = String(item).trim()
    return trimmed || null
  }

  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const record = item as Record<string, unknown>
    for (const key of STEP_TEXT_KEYS) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }

    for (const value of Object.values(record)) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }

  return null
}

export function normalizeChecklistSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(normalizeChecklistStepItem)
    .filter((step): step is string => step !== null)
}
