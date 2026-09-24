export async function savePlannerPlanFile(workspace: string, markdown: string): Promise<string> {
  const save = window.api?.fs?.savePlannerPlan
  if (typeof save !== 'function') throw new Error('savePlannerPlan is unavailable')
  return save(markdown, workspace)
}
