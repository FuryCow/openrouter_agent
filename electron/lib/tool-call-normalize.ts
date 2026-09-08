import { normalizeChecklistSteps } from './checklist-steps'

export function normalizeToolCall(
  toolName: string,
  parsed: Record<string, unknown>
): { name: string; args: Record<string, unknown> } {
  if (toolName === 'create_task_checklist') {
    return {
      name: toolName,
      args: {
        ...parsed,
        steps: normalizeChecklistSteps(parsed.steps)
      }
    }
  }

  if (toolName === 'grep') {
    const query = String(parsed.pattern ?? parsed.query ?? '').trim()
    const pathArg = parsed.path ?? parsed.root
    const path =
      pathArg !== undefined && pathArg !== null ? String(pathArg).trim() : ''
    const root = path && path !== '.' ? path : parsed.root

    return {
      name: 'grep_workspace',
      args: {
        ...parsed,
        query,
        ...(root !== undefined && root !== null && String(root).trim() && String(root).trim() !== '.'
          ? { root: String(root).trim() }
          : {})
      }
    }
  }

  return { name: toolName, args: parsed }
}
