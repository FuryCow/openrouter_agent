import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { cn } from '@/lib/utils'

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
  )
}

export function MarkdownContent({
  content,
  className,
  isError
}: {
  content: string
  className?: string
  isError?: boolean
}): React.ReactElement {
  return (
    <div
      className={cn(
        'chat-markdown text-sm leading-relaxed',
        isError ? 'text-red-200' : 'text-zinc-300',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
