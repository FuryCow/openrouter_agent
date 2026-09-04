import { CHAT_MODES, getChatModeConfig, type ChatMode } from '@/lib/chatModes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { cn } from '@/lib/utils'

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
          'h-7 w-auto gap-1.5 border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-medium hover:bg-white/[0.07]',
          disabled && 'opacity-50'
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', current.accentClass)} />
        <SelectValue>{current.label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[15rem]">
        {CHAT_MODES.map((item) => {
          const ItemIcon = item.icon
          return (
            <SelectItem key={item.id} value={item.id} className="py-2">
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 font-medium text-zinc-200">
                  <ItemIcon className={cn('h-3.5 w-3.5', item.accentClass)} />
                  {item.label}
                </span>
                <span className="pl-5 text-[10px] leading-snug text-zinc-500">
                  {item.description}
                </span>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
