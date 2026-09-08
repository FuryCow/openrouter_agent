import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyStateShell({
  title,
  description,
  icon: Icon,
  children,
  compact = false,
  className
}: {
  title: string
  description: string
  icon?: LucideIcon
  children: React.ReactNode
  compact?: boolean
  className?: string
}): React.ReactElement {
  if (compact) {
    return (
      <div
        className={cn(
          'w-full rounded-2xl border border-white/10 bg-background/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] backdrop-blur-sm',
          className
        )}
      >
        <div className="mb-4 flex items-start gap-3">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20">
              <Icon className="h-5 w-5 text-indigo-300" />
            </div>
          )}
          <div className="min-w-0 text-left">
            <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
          </div>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className={cn('relative flex h-full items-center justify-center overflow-hidden p-6', className)}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-background/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset] backdrop-blur-sm">
        <div className="mb-5 flex items-start gap-3">
          {Icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/20">
              <Icon className="h-5 w-5 text-indigo-300" />
            </div>
          )}
          <div>
            <h2 className="text-base font-medium text-zinc-100">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
