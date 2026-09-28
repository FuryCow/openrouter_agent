export async function respondToPendingApproval(input: {
  pending: { id: string; name: string } | null
  approved: boolean
  alwaysAllow?: boolean
  approve: (id: string, approved: boolean) => Promise<void>
  setSessionAutoApprove: (toolName: string) => Promise<void>
}): Promise<boolean> {
  if (!input.pending) return false
  if (input.alwaysAllow && input.approved) {
    await input.setSessionAutoApprove(input.pending.name)
  }
  await input.approve(input.pending.id, input.approved)
  return true
}
