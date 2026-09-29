import { useTranslation } from 'react-i18next'
import { Shield } from 'lucide-react'
import type { ModelEndpoint } from '@/types'
import { cn } from '@/lib/utils'

export function VendorPrivacy({ endpoint }: { endpoint: ModelEndpoint }): React.ReactElement | null {
  const { t } = useTranslation('layout')
  if (endpoint.retainsPrompts == null && endpoint.trainsOnData == null) return null

  const logs = endpoint.retainsPrompts === true || endpoint.trainsOnData === true
  const parts: string[] = []
  if (endpoint.trainsOnData) parts.push(t('models.vendor.privacy.trains'))
  if (endpoint.retainsPrompts) {
    parts.push(
      endpoint.retentionDays
        ? t('models.vendor.privacy.retainsDays', { days: endpoint.retentionDays })
        : t('models.vendor.privacy.retains')
    )
  } else if (!endpoint.trainsOnData) {
    parts.push(t('models.vendor.privacy.noRetention'))
  }

  return (
    <span title={parts.join(' · ')} className="inline-flex shrink-0 items-center justify-center">
      <Shield className={cn('h-3.5 w-3.5', logs ? 'text-amber-400' : 'text-emerald-400')} />
    </span>
  )
}
