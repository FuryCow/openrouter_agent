export function formatAppVersionLabel(version: string | null | undefined): string {
  const trimmed = version?.trim() ?? ''
  if (!trimmed) return ''
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`
}
