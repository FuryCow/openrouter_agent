import { cn } from '@/lib/utils'
import type { ToolCallInfo } from '@/types'
import {
  buildToolArgsView,
  buildToolResultView,
  truncateText,
  type ToolArgsView,
  type ToolResultView
} from '@/lib/toolCallDisplay'
import { FilePathLink } from './FilePathLink'

function ToolSection({
  label,
  children,
  className
}: {
  label: string
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      {children}
    </div>
  )
}

function ToolMetaChips({ items }: { items: Array<{ label: string; value: string }> }): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={`${item.label}-${item.value}`}
          className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-400"
        >
          <span className="text-zinc-500">{item.label}</span>{' '}
          <span className="font-mono text-zinc-300">{item.value}</span>
        </span>
      ))}
    </div>
  )
}

function ToolTextBlock({
  text,
  tone = 'default',
  mono = true
}: {
  text: string
  tone?: 'default' | 'muted' | 'error' | 'success'
  mono?: boolean
}): React.ReactElement {
  return (
    <pre
      className={cn(
        'rounded-md bg-black/30 px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words',
        mono && 'font-mono',
        tone === 'error' && 'text-red-300',
        tone === 'success' && 'text-emerald-300',
        tone === 'muted' && 'text-zinc-500',
        tone === 'default' && 'text-zinc-300'
      )}
    >
      {truncateText(text)}
    </pre>
  )
}

function ToolArgsPreview({ view }: { view: ToolArgsView }): React.ReactElement | null {
  switch (view.kind) {
    case 'empty':
      return null
    case 'paths':
      return (
        <ToolSection label="Files">
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {view.paths.map((path) => (
              <FilePathLink key={path} path={path} className="text-xs" />
            ))}
          </div>
        </ToolSection>
      )
    case 'file-path':
      return (
        <ToolSection label="File">
          <FilePathLink path={view.path} className="text-xs" />
        </ToolSection>
      )
    case 'search-replace':
      return (
        <div className="space-y-2">
          <ToolSection label="File">
            <FilePathLink path={view.path} className="text-xs" />
          </ToolSection>
          {view.replaceAll && (
            <div className="text-[10px] text-amber-300/80">Replace all occurrences</div>
          )}
          <ToolSection label="Change">
            <div className="overflow-hidden rounded-md border border-white/5 bg-black/25 font-mono text-xs">
              {view.oldString && (
                <div className="border-b border-white/5 bg-red-500/10 px-2.5 py-1.5 text-red-100 whitespace-pre-wrap break-words">
                  {truncateText(view.oldString, 1200)}
                </div>
              )}
              {view.newString && (
                <div className="bg-emerald-500/10 px-2.5 py-1.5 text-emerald-100 whitespace-pre-wrap break-words">
                  {truncateText(view.newString, 1200)}
                </div>
              )}
            </div>
          </ToolSection>
        </div>
      )
    case 'query':
      return (
        <div className="space-y-2">
          <ToolSection label="Query">
            <ToolTextBlock text={view.query} mono />
          </ToolSection>
          {view.meta.length > 0 && <ToolMetaChips items={view.meta} />}
        </div>
      )
    case 'command':
      return (
        <ToolSection label="Command">
          <ToolTextBlock text={view.command} />
        </ToolSection>
      )
    case 'memory-read': {
      const items = [
        ...(view.category ? [{ label: 'category', value: view.category }] : []),
        ...(view.query ? [{ label: 'query', value: view.query }] : [])
      ]
      if (items.length === 0) return null
      return (
        <ToolSection label="Filter">
          <ToolMetaChips items={items} />
        </ToolSection>
      )
    }
    case 'memory-update':
      return (
        <div className="space-y-2">
          <ToolMetaChips
            items={[
              { label: 'action', value: view.action },
              ...(view.category ? [{ label: 'category', value: view.category }] : []),
              ...(view.id ? [{ label: 'id', value: view.id }] : [])
            ]}
          />
          {view.content && (
            <ToolSection label="Content">
              <ToolTextBlock text={view.content} mono={false} />
            </ToolSection>
          )}
        </div>
      )
    case 'generic':
      return (
        <ToolSection label="Input">
          <div className="space-y-1.5">
            {view.fields.map((field) => (
              <div key={field.key} className="rounded-md bg-black/25 px-2.5 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">{field.key}</div>
                <div className="mt-0.5 font-mono text-xs text-zinc-300 whitespace-pre-wrap break-words">
                  {truncateText(field.value, 1500)}
                </div>
              </div>
            ))}
          </div>
        </ToolSection>
      )
  }
}

function ToolResultPreview({ view }: { view: ToolResultView }): React.ReactElement | null {
  switch (view.kind) {
    case 'empty':
      return null
    case 'message':
      return (
        <ToolSection label="Result">
          <ToolTextBlock text={view.text} tone={view.tone} mono={false} />
        </ToolSection>
      )
    case 'text':
      return (
        <ToolSection label="Output">
          <ToolTextBlock text={view.text} tone={view.tone} />
        </ToolSection>
      )
    case 'file-sections':
      return (
        <ToolSection label="Output">
          <div className="space-y-2">
            {view.sections.map((section) => (
              <div key={section.path} className="overflow-hidden rounded-md border border-white/5">
                <div className="border-b border-white/5 bg-white/[0.03] px-2.5 py-1.5">
                  <FilePathLink path={section.path} className="text-xs" />
                </div>
                <pre
                  className={cn(
                    'px-2.5 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words',
                    section.error ? 'text-red-300' : 'text-zinc-400'
                  )}
                >
                  {truncateText(section.error ? section.error : section.content, 2500)}
                </pre>
              </div>
            ))}
          </div>
        </ToolSection>
      )
    case 'grep-hits':
      return (
        <ToolSection label={`Matches (${view.hits.length})`}>
          <div className="space-y-1">
            {view.hits.map((hit, index) => (
              <div
                key={`${hit.file}-${hit.line}-${index}`}
                className="rounded-md bg-black/25 px-2.5 py-1.5 text-xs"
              >
                <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <FilePathLink path={hit.file} className="text-[11px]" />
                  <span className="font-mono text-[10px] text-zinc-500">:{hit.line}</span>
                </div>
                <div className="font-mono text-zinc-400 whitespace-pre-wrap break-words">
                  {hit.content}
                </div>
              </div>
            ))}
          </div>
        </ToolSection>
      )
    case 'search-hits':
      return (
        <ToolSection label={`Hits (${view.hits.length})`}>
          <div className="space-y-1">
            {view.hits.map((hit, index) => (
              <div
                key={`${hit.path}-${hit.startLine}-${index}`}
                className="rounded-md bg-black/25 px-2.5 py-1.5 text-xs"
              >
                <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <FilePathLink path={hit.path} className="text-[11px]" />
                  <span className="font-mono text-[10px] text-zinc-500">
                    :{hit.startLine}-{hit.endLine}
                  </span>
                  <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[10px] text-violet-300">
                    {hit.channel}
                  </span>
                  {hit.symbol && (
                    <span className="font-mono text-[10px] text-indigo-300">{hit.symbol}</span>
                  )}
                </div>
                <div className="text-zinc-400 whitespace-pre-wrap break-words">{hit.snippet}</div>
              </div>
            ))}
          </div>
        </ToolSection>
      )
    case 'dir-list':
      return (
        <ToolSection label={`Entries (${view.entries.length})`}>
          <div className="rounded-md bg-black/25 px-2.5 py-2">
            {view.entries.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-2 py-0.5 font-mono text-xs text-zinc-400"
              >
                <span className={entry.isDirectory ? 'text-sky-400' : 'text-zinc-500'}>
                  {entry.isDirectory ? 'dir' : 'file'}
                </span>
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </ToolSection>
      )
    case 'web-results':
      return (
        <ToolSection label={`Results (${view.items.length})`}>
          <div className="space-y-2">
            {view.items.map((item) => (
              <div key={item.url} className="rounded-md bg-black/25 px-2.5 py-2 text-xs">
                <div className="font-medium text-zinc-200">{item.title}</div>
                <a
                  href={item.url}
                  className="mt-0.5 block truncate text-indigo-400 hover:text-indigo-300"
                  onClick={(event) => event.stopPropagation()}
                >
                  {item.url}
                </a>
                {item.snippet && (
                  <div className="mt-1 text-zinc-500 whitespace-pre-wrap break-words">
                    {item.snippet}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ToolSection>
      )
  }
}

export function ToolCallDetailView({
  toolCall,
  showDiff
}: {
  toolCall: ToolCallInfo
  showDiff: boolean
}): React.ReactElement {
  let argsView = buildToolArgsView(toolCall.name, toolCall.arguments)
  if (showDiff && argsView.kind === 'search-replace') {
    argsView = { kind: 'file-path', path: argsView.path }
  }

  const resultView = buildToolResultView(toolCall.name, toolCall.result)
  const isRunning = toolCall.status === 'running'

  return (
    <div className="space-y-3">
      {isRunning && !toolCall.arguments.trim() && (
        <div className="text-xs text-zinc-500">Подготовка аргументов…</div>
      )}

      <ToolArgsPreview view={argsView} />

      {!isRunning && <ToolResultPreview view={resultView} />}
    </div>
  )
}
