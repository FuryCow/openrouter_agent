import { Eye, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownViewToggleProps {
  mode: 'edit' | 'preview'
  onChange: (mode: 'edit' | 'preview') => void
}

export function MarkdownViewToggle({
  mode,
  onChange
}: MarkdownViewToggleProps): React.ReactElement {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-white/5 bg-white/[0.03] p-0.5">
      <button
        type="button"
        onClick={() => onChange('edit')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
          mode === 'edit'
            ? 'bg-[#0a0a0f] text-zinc-200 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        )}
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => onChange('preview')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
          mode === 'preview'
            ? 'bg-[#0a0a0f] text-zinc-200 shadow-sm'
            : 'text-zinc-500 hover:text-zinc-300'
        )}
      >
        <Eye className="h-3 w-3" />
        Preview
      </button>
    </div>
  )
}
