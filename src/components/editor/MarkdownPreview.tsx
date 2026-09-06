import { MarkdownContent } from '@/components/chat/MarkdownContent'
import { ScrollArea } from '@/components/ui/scroll-area'

export function MarkdownPreview({ content }: { content: string }): React.ReactElement {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl px-8 py-6">
        <MarkdownContent
          content={content}
          variant="document"
          className="text-[15px] leading-7"
        />
      </div>
    </ScrollArea>
  )
}
