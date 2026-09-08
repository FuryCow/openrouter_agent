import { cn } from '@/lib/utils'
import { parseDiffText } from '@/lib/parseDiff'
import { trimDiffDisplayLines } from '@/lib/trimDiffDisplayLines'
import type { DiffDisplayLine, FileDiffPreview } from '@/types'

const lineStyles: Record<string, string> = {
  add: 'bg-emerald-500/12 text-emerald-100',
  del: 'bg-red-500/12 text-red-100',
  ctx: 'bg-transparent text-zinc-400',
  sep: 'bg-white/[0.02] text-zinc-600'
}

const gutterStyles: Record<string, string> = {
  add: 'text-emerald-400/45',
  del: 'text-red-400/45',
  ctx: 'text-zinc-600',
  sep: 'text-zinc-600'
}

type DiffViewProps = {
  fileDiff?: FileDiffPreview
  /** @deprecated Legacy text diff */
  diff?: string
  filePath?: string
  className?: string
}

function formatLineNumber(value?: number): string {
  return value !== undefined ? String(value) : ''
}

function resolveLines(fileDiff?: FileDiffPreview, diff?: string): DiffDisplayLine[] {
  if (fileDiff?.lines?.length) return trimDiffDisplayLines(fileDiff.lines)
  if (diff) return trimDiffDisplayLines(parseDiffText(diff))
  return []
}

export function DiffView({ fileDiff, diff, filePath, className }: DiffViewProps): React.ReactElement {
  const lines = resolveLines(fileDiff, diff)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-white/10 bg-background/80',
        className
      )}
    >
      {filePath && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
          <span className="truncate font-mono text-[11px] text-zinc-400">{filePath}</span>
        </div>
      )}

      <div className="font-mono text-[11px] leading-5">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, index) =>
              line.type === 'sep' ? (
                <tr key={`${index}-sep`} className={lineStyles.sep}>
                  <td colSpan={3} className="px-2 py-0.5 text-center select-none">
                    {line.content}
                  </td>
                </tr>
              ) : (
                <tr key={`${index}-${line.type}-${line.oldLine}-${line.newLine}`} className={cn(lineStyles[line.type])}>
                  <td
                    className={cn(
                      'w-9 select-none border-r border-white/5 px-2 py-0 text-right align-top',
                      gutterStyles[line.type]
                    )}
                  >
                    {formatLineNumber(line.oldLine)}
                  </td>
                  <td
                    className={cn(
                      'w-9 select-none border-r border-white/5 px-2 py-0 text-right align-top',
                      gutterStyles[line.type]
                    )}
                  >
                    {formatLineNumber(line.newLine)}
                  </td>
                  <td className="whitespace-pre-wrap break-all px-2 py-0 align-top">
                    <span className="mr-1.5 select-none opacity-70">
                      {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
                    </span>
                    {line.content || ' '}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
