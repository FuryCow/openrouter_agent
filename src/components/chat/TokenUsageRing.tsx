import { useState, useEffect, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { RotateCcw } from 'lucide-react'
import {
  useContextEstimate,
  readContextEstimateFromStores,
  type ContextEstimate
} from '@/hooks/useContextEstimate'
import { formatTokenCount } from '@/lib/formatTokens'
import { formatNumber } from '@/i18n/t'
import { useTokenUsageStore } from '@/stores/tokenUsageStore'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const POPOVER_REFRESH_MS = 1000

function ringColor(percent: number): string {
  if (percent >= 85) return 'text-red-400'
  if (percent >= 65) return 'text-amber-400'
  return 'text-indigo-400'
}

function barColor(percent: number): string {
  if (percent >= 85) return 'bg-red-500'
  if (percent >= 65) return 'bg-amber-500'
  return 'bg-indigo-500'
}

function StatRow({
  label,
  value,
  sub
}: {
  label: string
  value: string
  sub?: string
}): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="text-right">
        <div className="font-mono text-base tabular-nums text-zinc-200">{value}</div>
        {sub && <div className="text-xs tabular-nums text-zinc-500">{sub}</div>}
      </div>
    </div>
  )
}

function RingSvg({
  contextPercent,
  size = 22
}: {
  contextPercent: number
  size?: number
}): ReactElement {
  const stroke = 2.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (contextPercent / 100) * circumference

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-white/10"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cn('transition-[stroke-dashoffset] duration-300', ringColor(contextPercent))}
      />
    </svg>
  )
}

function PopoverBody({
  estimate,
  modelName,
  onResetSession
}: {
  estimate: ContextEstimate
  modelName?: string
  onResetSession: () => void
}): ReactElement {
  const { t } = useTranslation('chat')
  const session = useTokenUsageStore((s) => s.session)
  const { estimatedContext, contextLimit, contextPercent } = estimate

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-medium text-zinc-200">{t('tokens.title')}</div>
          {modelName && (
            <div className="mt-1 truncate text-xs text-zinc-500">{modelName}</div>
          )}
        </div>
        <div className={cn('font-mono text-xl font-semibold tabular-nums', ringColor(contextPercent))}>
          {contextPercent}%
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>{t('tokens.contextEstimate')}</span>
            <span className="font-mono text-sm tabular-nums text-zinc-300">
              {formatTokenCount(estimatedContext)} / {formatTokenCount(contextLimit)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn('h-full rounded-full transition-all duration-300', barColor(contextPercent))}
              style={{ width: `${contextPercent}%` }}
            />
          </div>
          <div className="mt-1.5 font-mono text-xs tabular-nums text-zinc-500">
            {formatNumber(estimatedContext)} / {formatNumber(contextLimit)}
          </div>
        </div>

        <div className="space-y-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t('tokens.session')}
          </div>
          <StatRow
            label={t('tokens.total')}
            value={formatTokenCount(session.totalTokens)}
            sub={formatNumber(session.totalTokens)}
          />
          <StatRow
            label={t('tokens.input')}
            value={formatTokenCount(session.promptTokens)}
            sub={formatNumber(session.promptTokens)}
          />
          <StatRow
            label={t('tokens.output')}
            value={formatTokenCount(session.completionTokens)}
            sub={formatNumber(session.completionTokens)}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end border-t border-white/5 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
          onClick={onResetSession}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('tokens.resetSession')}
        </Button>
      </div>
    </>
  )
}

export function TokenUsageRing({ compact = false }: { compact?: boolean }): ReactElement {
  const { t } = useTranslation('chat')
  const [open, setOpen] = useState(false)
  const ringEstimate = useContextEstimate()
  const sessionTotal = useTokenUsageStore((s) => s.session.totalTokens)
  const [popoverEstimate, setPopoverEstimate] = useState<ContextEstimate>(ringEstimate)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const resetSession = useTokenUsageStore((s) => s.resetSession)
  const modelId = useSettingsStore((s) => s.settings.model)
  const modelName = useSettingsStore((s) => s.models.find((m) => m.id === modelId)?.name)

  const handleOpenChange = (next: boolean): void => {
    if (next) {
      setPopoverEstimate(readContextEstimateFromStores())
    }
    setOpen(next)
  }

  useEffect(() => {
    if (!open || !isStreaming) return
    const id = window.setInterval(() => {
      setPopoverEstimate(readContextEstimateFromStores())
    }, POPOVER_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [open, isStreaming])

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300',
            compact ? 'size-7' : 'size-9',
            open && 'bg-white/5 text-zinc-300'
          )}
          aria-label={t('tokens.ariaLabel', {
            contextPercent: ringEstimate.contextPercent,
            sessionTotal: formatTokenCount(sessionTotal)
          })}
        >
          <RingSvg contextPercent={ringEstimate.contextPercent} size={compact ? 18 : 22} />
        </button>
      </Popover.Trigger>

      {open && (
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={8}
            className="z-50 w-80 rounded-xl border border-white/10 bg-surface p-4 shadow-2xl backdrop-blur-xl"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <PopoverBody
              estimate={popoverEstimate}
              modelName={modelName}
              onResetSession={resetSession}
            />
            <Popover.Arrow className="fill-surface" />
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  )
}
