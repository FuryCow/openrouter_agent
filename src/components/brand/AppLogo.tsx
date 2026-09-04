import appIcon from '@app-icon'
import { cn } from '@/lib/utils'

type AppLogoProps = {
  className?: string
  size?: 'sm' | 'md'
}

const sizeClass: Record<NonNullable<AppLogoProps['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9'
}

export function AppLogo({ className, size = 'sm' }: AppLogoProps): React.ReactElement {
  return (
    <img
      src={appIcon}
      alt="OpenRouter Agent"
      draggable={false}
      className={cn('shrink-0 rounded-[9px] object-cover', sizeClass[size], className)}
    />
  )
}
