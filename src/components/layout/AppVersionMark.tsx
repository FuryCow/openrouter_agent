import { formatAppVersionLabel } from '@/lib/appVersionLabel'

export function AppVersionMark({
  version,
  className
}: {
  version: string
  className?: string
}): React.ReactElement | null {
  const label = formatAppVersionLabel(version)
  if (!label) return null
  return (
    <span className={className} title={label}>
      {label}
    </span>
  )
}
