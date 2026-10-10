import { memo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

function CopyCodeButton({ getText }: { getText: () => string }): React.ReactElement {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }, [getText])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/40 text-zinc-500 transition-colors group-hover/code:text-zinc-200 hover:!text-zinc-100 focus-visible:text-zinc-200"
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
      onClick={(event) => {
        if (!href || (!href.startsWith('http://') && !href.startsWith('https://'))) return
        event.preventDefault()
        void window.api.shell.openExternal(href)
      }}
    >
      {children}
    </a>
  ),
  pre: ({ children, ...props }) => (
    <div className="group/code relative">
      <CopyCodeButton getText={() => extractPreText(children)} />
      <pre {...props}>{children}</pre>
    </div>
  )}

/** Extract raw text from a <pre> React children tree (code element inside). */
function extractPreText(children: React.ReactNode): string {
  let text = ''
  const walk = (node: React.ReactNode): void => {
    if (node === null || node === undefined || typeof node === 'boolean') return
    if (typeof node === 'string' || typeof node === 'number') {
      text += String(node)
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    const props = (node as { props?: { children?: React.ReactNode } }).props
    if (props?.children) walk(props.children)
  }
  walk(children)
  return text
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className,
  isError,
  variant = 'chat'
}: {
  content: string
  className?: string
  isError?: boolean
  variant?: 'chat' | 'document'
}): React.ReactElement {
  return (
    <div
      className={cn(
        variant === 'document' ? 'doc-markdown' : 'chat-markdown',
        variant === 'chat' ? 'text-sm leading-relaxed' : null,
        isError ? 'text-red-200' : 'text-zinc-300',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
})
