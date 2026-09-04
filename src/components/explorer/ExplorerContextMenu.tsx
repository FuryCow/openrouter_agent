import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export function ExplorerContextMenu({
  x,
  y,
  items,
  onClose
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}): React.ReactElement {
  const menuWidth = 200
  const menuHeight = items.length * 32 + 8
  const left = Math.min(x, window.innerWidth - menuWidth - 8)
  const top = Math.min(y, window.innerHeight - menuHeight - 8)

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        className="fixed z-50 min-w-[12.5rem] overflow-hidden rounded-lg border border-white/10 bg-[#1a1a26] py-1 shadow-xl"
        style={{ left, top }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            className={cn(
              'flex w-full px-3 py-1.5 text-left text-xs transition-colors',
              item.disabled
                ? 'cursor-not-allowed text-zinc-600'
                : item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-zinc-300 hover:bg-white/5'
            )}
            onClick={() => {
              if (item.disabled) return
              item.onClick()
              onClose()
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
