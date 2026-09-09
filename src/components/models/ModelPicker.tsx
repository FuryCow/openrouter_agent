import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Eye, Loader2, RefreshCw, Sparkles, Wrench } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import type { ModelInfo } from '@/types'
import { getModelPriceLabel, isStaleModelCatalog } from '@/lib/models'
import { cn } from '@/lib/utils'

type ModelSort = 'price-low' | 'price-high' | 'agentic' | 'name'

function sortModels(models: ModelInfo[], sort: ModelSort): ModelInfo[] {
  return [...models].sort((a, b) => {
    switch (sort) {
      case 'price-low': {
        const priceA = a.promptPricePerM ?? Number.POSITIVE_INFINITY
        const priceB = b.promptPricePerM ?? Number.POSITIVE_INFINITY
        if (priceA !== priceB) return priceA - priceB
        return a.name.localeCompare(b.name)
      }
      case 'price-high': {
        const priceA = a.promptPricePerM ?? -1
        const priceB = b.promptPricePerM ?? -1
        if (priceB !== priceA) return priceB - priceA
        return a.name.localeCompare(b.name)
      }
      case 'agentic': {
        const agenticA = a.agenticIndex ?? -1
        const agenticB = b.agenticIndex ?? -1
        if (agenticB !== agenticA) return agenticB - agenticA
        return a.name.localeCompare(b.name)
      }
      case 'name':
      default:
        return a.name.localeCompare(b.name)
    }
  })
}

function ModelRow({
  model,
  selected,
  onSelect
}: {
  model: ModelInfo
  selected: boolean
  onSelect: () => void
}): React.ReactElement {
  const { t } = useTranslation('layout')
  const pricing = getModelPriceLabel(model)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-indigo-500/15 ring-1 ring-indigo-500/30' : 'hover:bg-white/5'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-200">{model.name}</div>
          <div className="truncate text-[10px] text-zinc-500">{model.id}</div>
        </div>
        {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />}
      </div>

      <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-[11px] leading-tight text-emerald-100">
        {pricing}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
          <Wrench className="h-2.5 w-2.5" />
          {t('models.badge.tools')}
        </span>
        {model.supportsVision && (
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
            <Eye className="h-2.5 w-2.5" />
            {t('models.badge.vision')}
          </span>
        )}
        {model.agenticIndex != null && (
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
            {t('models.badge.agentic', { score: model.agenticIndex.toFixed(0) })}
          </span>
        )}
        {model.contextLabel && (
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {t('models.badge.context', { label: model.contextLabel })}
          </span>
        )}
      </div>
    </button>
  )
}

interface ModelPickerProps {
  value: string
  models: ModelInfo[]
  loading?: boolean
  onChange: (modelId: string) => void
  onRefresh?: () => void
  compact?: boolean
  className?: string
}

export function ModelPicker({
  value,
  models,
  loading = false,
  onChange,
  onRefresh,
  compact = false,
  className
}: ModelPickerProps): React.ReactElement {
  const { t } = useTranslation('layout')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [visionOnly, setVisionOnly] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)
  const [sort, setSort] = useState<ModelSort>('price-low')

  const selected = models.find((m) => m.id === value)
  const selectedPricing = selected ? getModelPriceLabel(selected) : null
  const staleCatalog = isStaleModelCatalog(models)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = models

    if (visionOnly) list = list.filter((m) => m.supportsVision)
    if (freeOnly) list = list.filter((m) => m.promptPricePerM === 0)

    if (q) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q)
      )
    }

    return sortModels(list, sort)
  }, [models, query, visionOnly, freeOnly, sort])

  const grouped = useMemo(() => {
    if (sort !== 'name') return null

    const groups = new Map<string, ModelInfo[]>()
    for (const model of filtered) {
      const provider = model.id.split('/')[0] || 'other'
      const list = groups.get(provider) ?? []
      list.push(model)
      groups.set(provider, list)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, sort])

  const handleFilterClick = (
    e: React.MouseEvent,
    action: () => void
  ): void => {
    e.preventDefault()
    e.stopPropagation()
    action()
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="secondary"
          className={cn(
            'justify-between gap-2 font-normal shadow-none transition-all',
            compact
              ? [
                  'h-8 min-h-8 max-w-[18rem] min-w-[11rem] rounded-md border border-indigo-500/20 px-2 py-0',
                  'bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-indigo-500/5',
                  'hover:border-indigo-400/30 hover:from-indigo-500/15 hover:brightness-110',
                  'data-[state=open]:border-indigo-400/35 data-[state=open]:shadow-[0_0_18px_-6px_rgba(99,102,241,0.5)]',
                  'focus-visible:ring-1 focus-visible:ring-indigo-500/30 focus-visible:ring-offset-0'
                ]
              : 'h-10 w-full border-white/10 bg-white/5 px-3 text-sm',
            className
          )}
        >
          {compact && (
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-gradient-to-br from-indigo-500/30 to-violet-500/20 ring-1 ring-inset ring-indigo-400/30">
              <Sparkles className="h-2.5 w-2.5 text-indigo-200" />
            </span>
          )}
          <div
            className={cn(
              'min-w-0 flex-1 text-left leading-tight',
              compact ? 'overflow-visible' : 'truncate'
            )}
          >
            <div
              className={cn(
                'truncate',
                compact ? 'text-[11px] font-semibold tracking-wide text-zinc-100' : 'text-sm'
              )}
            >
              {selected?.name || value || t('models.selectModel')}
            </div>
            {selectedPricing && (
              <div
                className={cn(
                  'whitespace-nowrap font-mono leading-none',
                  compact ? 'mt-0.5 text-[11px] text-emerald-400/80' : 'truncate text-[9px] text-emerald-400/80'
                )}
              >
                {selectedPricing}
              </div>
            )}
          </div>
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-zinc-500 transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align={compact ? 'end' : 'start'}
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-surface p-3 shadow-2xl backdrop-blur-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="mb-3 flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('models.searchPlaceholder')}
              className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
            />
            {onRefresh && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onRefresh()
                }}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => handleFilterClick(e, () => setVisionOnly((v) => !v))}
              className={cn(
                'rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                visionOnly
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                  : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
              )}
            >
              {t('models.filter.vision')}
            </button>

            <button
              type="button"
              onClick={(e) => handleFilterClick(e, () => setFreeOnly((v) => !v))}
              className={cn(
                'rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                freeOnly
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
              )}
            >
              {t('models.filter.free')}
            </button>

            <span className="mx-1 h-4 w-px bg-white/10" />

            {(
              [
                ['price-low', t('models.sort.cheapest')],
                ['price-high', t('models.sort.premium')],
                ['agentic', t('models.sort.agentic')],
                ['name', t('models.sort.name')]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={(e) => handleFilterClick(e, () => setSort(key))}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                  sort === key
                    ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
                    : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between px-1 text-[10px] text-zinc-500">
            <span>{t('models.caption')}</span>
            <span>
              {t('models.count', { filtered: filtered.length, total: models.length })}
            </span>
          </div>

          {staleCatalog && (
            <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              {t('models.staleCatalog')}
            </div>
          )}

          <ScrollArea className="h-80">
            {loading && models.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('models.loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-zinc-500">
                <span>{t('models.noMatch')}</span>
                {onRefresh && (
                  <Button variant="secondary" size="sm" onClick={onRefresh}>
                    {t('models.refreshList')}
                  </Button>
                )}
              </div>
            ) : grouped ? (
              <div className="space-y-3 pr-2">
                {grouped.map(([provider, providerModels]) => (
                  <div key={provider}>
                    <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                      {t('models.providerGroup', { provider, count: providerModels.length })}
                    </div>
                    <div className="space-y-1">
                      {providerModels.map((model) => (
                        <ModelRow
                          key={model.id}
                          model={model}
                          selected={model.id === value}
                          onSelect={() => {
                            onChange(model.id)
                            setOpen(false)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 pr-2">
                {filtered.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    selected={model.id === value}
                    onSelect={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
