import { CHAT_MODES, getChatModeConfig, type ChatMode } from '@/lib/chatModes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'

export function ChatModeSelector({
  mode,
  onModeChange,
  disabled
}: {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  disabled?: boolean
}): React.ReactElement {
  const current = getChatModeConfig(mode)
  const Icon = current.icon

  return (
    <Select value={mode} onValueChange={(v) => onModeChange(v as ChatMode)} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'group relative h-9 w-auto justify-start gap-2 overflow-hidden rounded-full border px-2.5 pr-2 text-left transition-all duration-300',
          'focus:ring-2 focus:ring-offset-0 focus:ring-offset-transparent',
          '[&>span:last-child_svg]:h-3.5 [&>span:last-child_svg]:w-3.5 [&>span:last-child_svg]:text-zinc-500',
          '[&>span:last-child]:ml-auto',
          '[&>span:last-child_svg]:transition-transform [&>span:last-child_svg]:duration-200',
          'data-[state=open]:[&>span:last-child_svg]:rotate-180',
          current.theme.trigger,
          current.theme.glow,
          disabled && 'opacity-50'
        )}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden
        >
          <span className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/10 blur-md" />
          <span className="absolute -right-2 top-0 h-full w-1/2 bg-gradient-to-l from-white/[0.06] to-transparent" />
        </span>

        <span
          className={cn(
            'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
            current.theme.iconBg
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', current.theme.icon)} />
        </span>

        <span className="relative flex min-w-0 flex-1 flex-col items-start leading-none">
          <span className="text-[11px] font-semibold tracking-wide text-zinc-100">
            {current.label}
          </span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            mode
          </span>
        </span>

        <span className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
          <SelectValue />
        </span>
      </SelectTrigger>

      <SelectContent
        align="start"
        className="min-w-[18rem] rounded-2xl border-white/10 bg-[#12121c]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          <Sparkles className="h-3 w-3 text-indigo-400/80" />
          Режим чата
        </div>

        {CHAT_MODES.map((item) => {
          const ItemIcon = item.icon
          const isActive = item.id === mode

          return (
            <SelectItem
              key={item.id}
              value={item.id}
              className={cn(
                'mb-1 rounded-xl border border-transparent p-0 pl-9 pr-2 last:mb-0',
                'focus:bg-transparent data-[highlighted]:bg-transparent',
                '[&>span:first-child]:top-3.5 [&>span:first-child]:left-2.5',
                item.theme.item,
                isActive && item.theme.itemActive
              )}
            >
              <div className="flex w-full items-start gap-3 py-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
                    item.theme.iconBg
                  )}
                >
                  <ItemIcon className={cn('h-4 w-4', item.theme.icon)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{item.label}</span>
                    {isActive && (
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-400">
                        active
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-500">{item.description}</p>
                </div>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
