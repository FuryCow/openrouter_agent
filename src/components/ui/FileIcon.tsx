import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  loadMaterialIconUrl,
  resolveFileIconKey,
  resolveFolderIconKey
} from '@/lib/material-icons'

interface FileIconProps {
  name: string
  isDirectory?: boolean
  isOpen?: boolean
  className?: string
}

function useMaterialIcon(iconKey: string): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void loadMaterialIconUrl(iconKey).then((loaded) => {
      if (!cancelled) {
        setUrl(loaded)
      }
    })

    return () => {
      cancelled = true
    }
  }, [iconKey])

  return url
}

export function FileIcon({
  name,
  isDirectory = false,
  isOpen = false,
  className
}: FileIconProps): React.ReactElement {
  const iconKey = isDirectory
    ? resolveFolderIconKey(name, isOpen)
    : resolveFileIconKey(name)
  const iconUrl = useMaterialIcon(iconKey)

  return (
    <span
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center',
        className
      )}
      aria-hidden
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" className="h-full w-full object-contain" draggable={false} />
      ) : (
        <span className="h-full w-full rounded-sm bg-white/10" />
      )}
    </span>
  )
}
