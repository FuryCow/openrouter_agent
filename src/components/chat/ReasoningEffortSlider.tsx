import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  clampReasoningEffortForModel,
  getReasoningEffortSteps,
  reasoningEffortFromStepIndex,
  reasoningEffortStepIndex,
  type ReasoningEffortLevel,
  type ReasoningRequestContext
} from '../../../shared/reasoning-effort'
import { cn } from '@/lib/utils'

const TRACK_INSET_PERCENT = 10

interface ReasoningEffortSliderProps {
  value: ReasoningEffortLevel
  onChange: (value: ReasoningEffortLevel) => void
  onCommit?: () => void
  disabled?: boolean
  supportsReasoning?: boolean
  reasoningMandatory?: boolean
  reasoningDefaultEffort?: string
  reasoningSupportedEfforts?: string[] | null
  className?: string
}

function stepPosition(index: number, maxStep: number): number {
  if (maxStep <= 0) return TRACK_INSET_PERCENT
  const span = 100 - TRACK_INSET_PERCENT * 2
  return TRACK_INSET_PERCENT + (index / maxStep) * span
}

export function ReasoningEffortSlider({
  value,
  onChange,
  onCommit,
  disabled = false,
  supportsReasoning = true,
  reasoningMandatory = false,
  reasoningDefaultEffort,
  reasoningSupportedEfforts,
  className
}: ReasoningEffortSliderProps): React.ReactElement | null {
  const { t } = useTranslation('chat')
  const effortContext = useMemo<ReasoningRequestContext>(
    () => ({
      mandatory: reasoningMandatory,
      defaultEffort: reasoningDefaultEffort,
      supportedEfforts: reasoningSupportedEfforts
    }),
    [reasoningMandatory, reasoningDefaultEffort, reasoningSupportedEfforts]
  )
  const steps = useMemo(() => getReasoningEffortSteps(effortContext), [effortContext])
  const displayValue = useMemo(
    () => clampReasoningEffortForModel(value, effortContext),
    [value, effortContext]
  )
  const maxStep = steps.length - 1
  const stepIndex = reasoningEffortStepIndex(displayValue, effortContext)
  const fillPercent = maxStep > 0 ? (stepIndex / maxStep) * 100 : 0

  const label = useMemo(
    () => t(`reasoningEffort.levels.${displayValue}`),
    [t, displayValue]
  )

  const hint = useMemo(
    () => t(`reasoningEffort.hints.${displayValue}`),
    [t, displayValue]
  )

  if (!supportsReasoning) return null

  return (
    <div
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5',
        disabled && 'pointer-events-none opacity-45',
        className
      )}
      title={hint}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400/80" aria-hidden />

      <div className="relative h-4 w-[5.25rem]">
        <div
          className="pointer-events-none absolute top-1/2 h-px -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.08]"
          style={{
            left: `${TRACK_INSET_PERCENT}%`,
            width: `${100 - TRACK_INSET_PERCENT * 2}%`
          }}
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500/55 via-violet-400/80 to-fuchsia-400/65 transition-[width] duration-200 ease-out"
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {steps.map((step, index) => {
          const isActive = index === stepIndex
          const isPassed = index < stepIndex
          const left = stepPosition(index, maxStep)

          return (
            <span
              key={step}
              className="pointer-events-none absolute top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%` }}
              aria-hidden
            >
              <span
                className={cn(
                  'block rounded-full transition-all duration-200',
                  isActive &&
                    'h-2 w-2 bg-violet-100 shadow-[0_0_0_2px_rgba(139,92,246,0.2),0_0_8px_rgba(167,139,250,0.3)]',
                  !isActive &&
                    isPassed &&
                    'h-1 w-1 bg-violet-400/75',
                  !isActive && !isPassed && 'h-1 w-1 bg-zinc-600/90'
                )}
              />
            </span>
          )
        })}

        <input
          type="range"
          min={0}
          max={maxStep}
          step={1}
          value={stepIndex}
          disabled={disabled}
          aria-label={t('reasoningEffort.ariaLabel')}
          aria-valuetext={label}
          onChange={(event) => {
            onChange(reasoningEffortFromStepIndex(Number(event.target.value), effortContext))
          }}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          className="reasoning-effort-slider absolute inset-0 z-10 w-full cursor-pointer"
        />
      </div>

      <span className="w-7 shrink-0 truncate text-right text-[10px] font-medium text-violet-200/95">
        {label}
      </span>
    </div>
  )
}
