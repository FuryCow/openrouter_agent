import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { cn } from '@/lib/utils'

export function ChatImagePreview({
  src,
  alt,
  className,
  thumbnailClassName
}: {
  src: string
  alt?: string
  className?: string
  thumbnailClassName?: string
}): React.ReactElement {
  const { t } = useTranslation('chat')
  const [open, setOpen] = useState(false)
  const label = alt ?? t('message.attachmentAlt')

  return (
    <>
      <button
        type="button"
        className={cn(
          'group relative block overflow-hidden rounded-md border border-white/10 transition',
          'hover:border-white/25 hover:ring-2 hover:ring-indigo-500/30',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
          className
        )}
        onClick={() => setOpen(true)}
        aria-label={t('imagePreview.view')}
      >
        <img src={src} alt={label} className={cn('block', thumbnailClassName)} />
        <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            'max-w-[min(92vw,1000px)] border-0 bg-transparent p-2 shadow-none sm:p-4',
            '[&>button]:text-white [&>button]:hover:bg-white/10'
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">{t('imagePreview.title')}</DialogTitle>
          <img
            src={src}
            alt={label}
            className="mx-auto max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
