import { useTranslation } from 'react-i18next'
import { useChatModes } from '@/hooks/useChatModes'
import type { ChatMode } from '@/lib/chatModes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { cn } from '@/lib/utils'

const MODE_SELECT_OPEN_MS = 340

export function ChatModeSelector({
  mode,
  onModeChange,
  disabled
}: {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  disabled?: boolean
}): React.ReactElement {
  const { t } = useTranslation('chat')
  const { modes, getModeConfig } = useChatModes()
  const current = getModeConfig(mode)
  const Icon = current.icon

  return (
    <Select value={mode} onValueChange={(v) => onModeChange(v as ChatMode)} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'relative h-7 w-auto min-w-[6.5rem] justify-start gap-1.5 rounded-md border px-1.5 pr-5 text-left shadow-none',
          'hover:brightness-110 focus:ring-1 focus:ring-offset-0',
          '[&>span:last-child]:absolute [&>span:last-child]:right-1 [&>span:last-child]:top-1/2 [&>span:last-child]:-translate-y-1/2',
          '[&>span:last-child_svg]:h-3 [&>span:last-child_svg]:w-3 [&>span:last-child_svg]:rotate-180 [&>span:last-child_svg]:opacity-60',
          '[&>span:last-child_svg]:transition-transform [&>span:last-child_svg]:duration-300 [&>span:last-child_svg]:ease-[cubic-bezier(0.22,1,0.36,1)]',
          'data-[state=open]:[&>span:last-child_svg]:rotate-0',
          current.theme.trigger,
          disabled && 'opacity-50'
        )}
      >
        <span
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] ring-1 ring-inset',
            current.theme.iconBg
          )}
        >
          <Icon className={cn('h-2.5 w-2.5', current.theme.icon)} />
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-zinc-100">{current.label}</span>
        <span className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
          <SelectValue />
        </span>
      </SelectTrigger>

      <SelectContent
        align="start"
        side="top"
        sideOffset={4}
        style={{
          ['--chat-mode-select-open-ms' as string]: `${MODE_SELECT_OPEN_MS}ms`
        }}
        className={cn(
          'chat-mode-select-content min-w-[10.5rem] max-w-[11.5rem] rounded-lg border border-white/10 bg-[#14141f]/98 p-0',
          'shadow-lg shadow-black/50 backdrop-blur-md',
          '[&>[data-radix-select-viewport]]:p-0'
        )}
      >
        <div className="chat-mode-select-panel p-1">
          <div className="px-2 pb-1 pt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-600">
            {t('modeSelector.title')}
          </div>

          {modes.map((item) => {
            const ItemIcon = item.icon
            const isActive = item.id === mode

            return (
              <SelectItem
                key={item.id}
                value={item.id}
                className={cn(
                  'mb-0.5 rounded-md border border-transparent py-0 pl-2 pr-7 last:mb-0',
                  'text-xs focus:bg-white/[0.04] data-[highlighted]:bg-white/[0.04]',
                  '[&>span:first-child]:left-auto [&>span:first-child]:right-2',
                  '[&>span:first-child]:top-1/2 [&>span:first-child]:-translate-y-1/2',
                  '[&>span:first-child_svg]:text-zinc-500',
                  isActive && cn('border-white/[0.06] bg-white/[0.03]', item.theme.itemActive)
                )}
              >
                <div className="flex items-center gap-2 py-1.5">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] ring-1 ring-inset',
                      item.theme.iconBg
                    )}
                  >
                    <ItemIcon className={cn('h-3 w-3', item.theme.icon)} />
                  </span>
                  <span className="font-medium text-zinc-200">{item.label}</span>
                </div>
              </SelectItem>
            )
          })}
        </div>
      </SelectContent>
    </Select>
  )
}

export function ChatModeDescription({ mode }: { mode: ChatMode }): React.ReactElement {
  const { getModeConfig } = useChatModes()
  const current = getModeConfig(mode)

  return (
    <p className="min-w-0 flex-1 truncate text-[11px] leading-snug text-zinc-500">{current.description}</p>
  )
}
