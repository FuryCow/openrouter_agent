import { cn } from '@/lib/utils'

type ToolIconKind =
  | 'read'
  | 'write'
  | 'patch'
  | 'folder'
  | 'search'
  | 'grep'
  | 'terminal'
  | 'web'
  | 'tabs'
  | 'memory-read'
  | 'memory-write'
  | 'mcp'
  | 'preparing'
  | 'group'
  | 'generic'

const ICON_SIZE_CLASS = 'h-5 w-5'

const ICON_STYLES: Record<ToolIconKind, string> = {
  read: 'text-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.6)]',
  write: 'text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]',
  patch: 'text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]',
  folder: 'text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.6)]',
  search: 'text-violet-400 drop-shadow-[0_0_4px_rgba(167,139,250,0.6)]',
  grep: 'text-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]',
  terminal: 'text-lime-400 drop-shadow-[0_0_4px_rgba(163,230,53,0.6)]',
  web: 'text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.6)]',
  tabs: 'text-indigo-400 drop-shadow-[0_0_4px_rgba(129,140,248,0.6)]',
  'memory-read': 'text-fuchsia-400 drop-shadow-[0_0_4px_rgba(232,121,249,0.6)]',
  'memory-write': 'text-pink-400 drop-shadow-[0_0_4px_rgba(244,114,182,0.6)]',
  mcp: 'text-teal-400 drop-shadow-[0_0_4px_rgba(45,212,191,0.6)]',
  preparing: 'text-zinc-400 drop-shadow-[0_0_3px_rgba(161,161,170,0.4)]',
  group: 'text-indigo-300 drop-shadow-[0_0_4px_rgba(165,180,252,0.5)]',
  generic: 'text-slate-400 drop-shadow-[0_0_3px_rgba(148,163,184,0.4)]'
}

export function resolveToolIconKind(toolName: string): ToolIconKind {
  if (toolName === 'preparing') return 'preparing'
  if (toolName.startsWith('mcp__')) return 'mcp'

  switch (toolName) {
    case 'read_file':
    case 'read_files':
      return 'read'
    case 'write_file':
      return 'write'
    case 'search_replace':
      return 'patch'
    case 'list_directory':
      return 'folder'
    case 'search_files':
    case 'codebase_search':
      return 'search'
    case 'grep_workspace':
      return 'grep'
    case 'run_terminal':
      return 'terminal'
    case 'web_search':
      return 'web'
    case 'get_open_files':
      return 'tabs'
    case 'read_project_memory':
      return 'memory-read'
    case 'update_project_memory':
      return 'memory-write'
    case 'create_task_checklist':
    case 'update_task_checklist':
      return 'group'
    default:
      return 'generic'
  }
}

type SvgProps = { className?: string }

function NeonSvg({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn(ICON_SIZE_CLASS, 'shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function ReadIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path d="M3 4.5h10v8H3z" stroke="currentColor"       strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M5.5 4.5V3.5h5v1" stroke="currentColor"       strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5 7.5h6M5 9.5h4" stroke="currentColor"       strokeWidth="1.45" strokeLinecap="round" opacity="0.85" />
      <circle cx="11.5" cy="7" r="1.1" stroke="currentColor"       strokeWidth="1.35" />
    </NeonSvg>
  )
}

function WriteIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path d="M3.5 12.5h9" stroke="currentColor"       strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M6 11.5l5.5-5.5 1.5 1.5L7.5 13H6v-1.5z"
        stroke="currentColor"
              strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path d="M10 5.5l1.5 1.5" stroke="currentColor"       strokeWidth="1.45" strokeLinecap="round" />
    </NeonSvg>
  )
}

function PatchIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path d="M2.5 5.5h3v3h-3zM10.5 7.5h3v3h-3z" stroke="currentColor"       strokeWidth="1.45" />
      <path
        d="M5.8 7h4.4M7.2 5.6l1.6 1.6M7.2 8.4l1.6-1.6"
        stroke="currentColor"
              strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </NeonSvg>
  )
}

function FolderIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path
        d="M2.5 5.5h4l1.2 1.3h5.8v5.2H2.5V5.5z"
        stroke="currentColor"
              strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M2.5 5.5l1.3-1.8h3.4l1 1.8" stroke="currentColor"       strokeWidth="1.45" strokeLinejoin="round" />
    </NeonSvg>
  )
}

function SearchIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <circle cx="7" cy="7" r="3.1" stroke="currentColor"       strokeWidth="1.5" />
      <path d="M9.4 9.4l3 3" stroke="currentColor"       strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.5 7h3M7 5.5v3" stroke="currentColor"       strokeWidth="1.25" strokeLinecap="round" opacity="0.7" />
    </NeonSvg>
  )
}

function GrepIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path d="M3 4.5h10M3 8h7M3 11.5h10" stroke="currentColor"       strokeWidth="1.45" strokeLinecap="round" />
      <path
        d="M11.5 7.5l2 2-2 2"
        stroke="currentColor"
              strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </NeonSvg>
  )
}

function TerminalIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <rect x="2.5" y="3" width="11" height="10" rx="1.2" stroke="currentColor"       strokeWidth="1.5" />
      <path d="M4.5 6.5l2 1.5-2 1.5M8 9.5h3.5" stroke="currentColor"       strokeWidth="1.45" strokeLinecap="round" />
    </NeonSvg>
  )
}

function WebIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <circle cx="8" cy="8" r="4.5" stroke="currentColor"       strokeWidth="1.45" />
      <ellipse cx="8" cy="8" rx="2" ry="4.5" stroke="currentColor"       strokeWidth="1.25" opacity="0.85" />
      <path d="M3.5 8h9M8 3.5v9" stroke="currentColor"       strokeWidth="1.25" opacity="0.65" />
    </NeonSvg>
  )
}

function TabsIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <rect x="3" y="4" width="8" height="6" rx="0.8" stroke="currentColor"       strokeWidth="1.45" />
      <rect x="5" y="6" width="8" height="6" rx="0.8" stroke="currentColor"       strokeWidth="1.45" opacity="0.75" />
    </NeonSvg>
  )
}

function MemoryReadIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path
        d="M8 2.5l4.5 2v5L8 11.5 3.5 9V4.5L8 2.5z"
        stroke="currentColor"
              strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="7" r="1.3" stroke="currentColor"       strokeWidth="1.35" />
    </NeonSvg>
  )
}

function MemoryWriteIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path
        d="M8 2.5l4.5 2v5L8 11.5 3.5 9V4.5L8 2.5z"
        stroke="currentColor"
              strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path d="M8 5.5v3M6.5 7h3" stroke="currentColor"       strokeWidth="1.45" strokeLinecap="round" />
    </NeonSvg>
  )
}

function McpIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <rect x="2.5" y="5" width="4.5" height="6" rx="1" stroke="currentColor"       strokeWidth="1.45" />
      <rect x="9" y="5" width="4.5" height="6" rx="1" stroke="currentColor"       strokeWidth="1.45" />
      <path d="M7 8h2" stroke="currentColor"       strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="8" r="1" fill="currentColor" />
      <circle cx="9" cy="8" r="1" fill="currentColor" />
    </NeonSvg>
  )
}

function PreparingIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <circle cx="4.5" cy="8" r="1.3" fill="currentColor" opacity="0.45" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" opacity="0.75" />
      <circle cx="11.5" cy="8" r="1.3" fill="currentColor" />
    </NeonSvg>
  )
}

function GroupIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path d="M3 11.5l5-7 5 7H3z" stroke="currentColor"       strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M6.5 9.5h3" stroke="currentColor"       strokeWidth="1.35" strokeLinecap="round" opacity="0.8" />
    </NeonSvg>
  )
}

function GenericIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={className}>
      <path
        d="M8 2.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L8 2.5z"
        stroke="currentColor"
              strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </NeonSvg>
  )
}

const ICONS: Record<ToolIconKind, (props: SvgProps) => React.ReactElement> = {
  read: ReadIcon,
  write: WriteIcon,
  patch: PatchIcon,
  folder: FolderIcon,
  search: SearchIcon,
  grep: GrepIcon,
  terminal: TerminalIcon,
  web: WebIcon,
  tabs: TabsIcon,
  'memory-read': MemoryReadIcon,
  'memory-write': MemoryWriteIcon,
  mcp: McpIcon,
  preparing: PreparingIcon,
  group: GroupIcon,
  generic: GenericIcon
}

export function ToolTypeIcon({
  toolName,
  kind,
  className
}: {
  toolName?: string
  kind?: ToolIconKind
  className?: string
}): React.ReactElement {
  const resolved = kind ?? resolveToolIconKind(toolName ?? '')
  const Icon = ICONS[resolved]
  return <Icon className={cn(ICON_STYLES[resolved], className)} />
}

export function ThinkingIcon({ className }: SvgProps): React.ReactElement {
  return (
    <NeonSvg className={cn('text-violet-400 drop-shadow-[0_0_4px_rgba(167,139,250,0.6)]', className)}>
      <circle cx="4.5" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="8" cy="5" r="1.4" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="11.5" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="8" cy="11" r="1.4" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M5.6 7.2 7 6M9 6l1.4 1.2M9.8 8.8 8 9.8M7 9.8 5.2 8.8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.85"
      />
    </NeonSvg>
  )
}
