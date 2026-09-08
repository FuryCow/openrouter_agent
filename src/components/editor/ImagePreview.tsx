import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export function ImagePreview({
  src,
  alt,
  className
}: {
  src: string
  alt: string
  className?: string
}): React.ReactElement {
  return (
    <ScrollArea className={cn('h-full', className)}>
      <div
        className="flex min-h-full items-center justify-center p-8"
        style={{
          backgroundImage:
            'linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px'
        }}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[calc(100vh-10rem)] max-w-full rounded-lg border border-white/10 object-contain shadow-2xl shadow-black/40"
          draggable={false}
        />
      </div>
    </ScrollArea>
  )
}
