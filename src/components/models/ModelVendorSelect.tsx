import { useEffect, useRef, useState } from 'react'
import { useModelEndpoints } from '@/hooks/useModelEndpoints'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { VendorPrivacy } from './VendorPrivacy'
import * as Popover from '@radix-ui/react-popover'
import { Button } from '../ui/button'
import type { ModelEndpoint } from '@/types'
import { cn } from '@/lib/utils'

interface ModelVendorSelectProps {
  modelId: string
  value: string
  catalogPriceLabel?: string | null
  onChange: (tag: string) => void
}

export function ModelVendorSelect({
  modelId,
  value,
  catalogPriceLabel,
  onChange
}: ModelVendorSelectProps): React.ReactElement | null {
  const { t } = useTranslation('layout')
  const [open, setOpen] = useState(false)
  const { endpoints, loading, failed } = useModelEndpoints(modelId)
  const resetKey = useRef('')

  useEffect(() => {
    if (loading || failed || !value) return
    if (endpoints.some((endpoint) => endpoint.tag === value)) return
    const key = `${modelId}:${value}`
    if (resetKey.current === key) return
    resetKey.current = key
    onChange('')
  }, [endpoints, failed, loading, modelId, onChange, value])

  const selected = endpoints.find((endpoint) => endpoint.tag === value) ?? null

  if (!modelId) return null

  const closedName = selected?.name ?? t('models.vendor.auto')
  const closedPrice = selected?.priceLabel ?? catalogPriceLabel

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="secondary"
          aria-label={t('models.vendor.ariaLabel')}
          className={cn(
            'h-8 max-w-[16.5rem] justify-between gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 font-normal shadow-none',
            'hover:border-white/15 hover:bg-white/[0.05]'
          )}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-zinc-500" />
          ) : (
            <VendorIcon url={selected?.iconUrl} />
          )}
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate text-[11px] font-medium text-zinc-200">{closedName}</span>
            {closedPrice ? (
              <span className="mt-0.5 block whitespace-nowrap font-mono text-[10px] leading-none text-emerald-400/80">
                {closedPrice}
              </span>
            ) : null}
          </span>
          {selected ? <VendorPrivacy endpoint={selected} /> : null}
          <ChevronDown className={cn('h-3 w-3 shrink-0 text-zinc-500', open && 'rotate-180')} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 w-72 rounded-xl border border-white/10 bg-surface p-1.5 shadow-2xl"
        >
          {loading ? (
            <div className="px-2 py-2 text-xs text-zinc-500">{t('models.vendor.loading')}</div>
          ) : failed ? (
            <div className="px-2 py-2 text-xs text-zinc-500">{t('models.vendor.loadFailed')}</div>
          ) : (
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              <VendorRow
                name={t('models.vendor.auto')}
                price={catalogPriceLabel}
                selected={!value}
                onSelect={() => {
                  onChange('')
                  setOpen(false)
                }}
              />
              {endpoints.length === 0 ? (
                <div className="px-2 py-2 text-xs text-zinc-500">{t('models.vendor.empty')}</div>
              ) : (
                endpoints.map((endpoint) => (
                  <VendorRow
                    key={endpoint.tag}
                    endpoint={endpoint}
                    selected={endpoint.tag === value}
                    onSelect={() => {
                      onChange(endpoint.tag)
                      setOpen(false)
                    }}
                  />
                ))
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function VendorRow({
  name,
  price,
  endpoint,
  selected,
  onSelect
}: {
  name: string
  price?: string | null
  endpoint?: ModelEndpoint
  selected: boolean
  onSelect: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
        selected ? 'bg-indigo-500/15' : 'hover:bg-white/5'
      )}
    >
      <VendorIcon url={endpoint?.iconUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-zinc-200">{endpoint?.name ?? name}</span>
        {(endpoint?.priceLabel ?? price) ? (
          <span className="block truncate font-mono text-[10px] text-emerald-300/90">
            {endpoint?.priceLabel ?? price}
          </span>
        ) : null}
      </span>
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {endpoint ? <VendorPrivacy endpoint={endpoint} /> : null}
      </span>
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {selected ? <Check className="h-3.5 w-3.5 text-indigo-300" /> : null}
      </span>
    </button>
  )
}

function VendorIcon({ url }: { url?: string | null }): React.ReactElement {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return <span className="h-6 w-6 shrink-0" />
  return (
    <img
      src={url}
      alt=""
      className="h-6 w-6 shrink-0 rounded-sm object-contain"
      onError={() => setFailed(true)}
    />
  )
}

