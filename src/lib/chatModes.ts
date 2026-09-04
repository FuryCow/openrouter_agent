import type { LucideIcon } from 'lucide-react'
import { Bot, MessageCircleQuestion, Map } from 'lucide-react'

export type ChatMode = 'agent' | 'ask' | 'planner'

export interface ChatModeConfig {
  id: ChatMode
  label: string
  description: string
  placeholder: string
  requiresWorkspace: boolean
  icon: LucideIcon
  accentClass: string
  theme: {
    icon: string
    iconBg: string
    trigger: string
    glow: string
    item: string
    itemActive: string
  }
}

export const CHAT_MODES: ChatModeConfig[] = [
  {
    id: 'agent',
    label: 'Агент',
    description: 'Читает, пишет файлы, запускает команды и использует инструменты',
    placeholder: 'Попросите агента что-то сделать в проекте...',
    requiresWorkspace: true,
    icon: Bot,
    accentClass: 'text-indigo-300',
    theme: {
      icon: 'text-indigo-200',
      iconBg: 'bg-gradient-to-br from-indigo-500/30 to-violet-500/20 ring-indigo-400/30',
      trigger:
        'border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-indigo-500/5 hover:border-indigo-400/40 hover:from-indigo-500/15',
      glow: 'shadow-[0_0_20px_-6px_rgba(99,102,241,0.55)]',
      item: 'hover:bg-indigo-500/10 data-[highlighted]:bg-indigo-500/10',
      itemActive: 'bg-indigo-500/15 ring-1 ring-indigo-400/25'
    }
  },
  {
    id: 'ask',
    label: 'ASK',
    description: 'Ответы на вопросы без изменений в проекте',
    placeholder: 'Задайте вопрос о коде, технологиях или задаче...',
    requiresWorkspace: false,
    icon: MessageCircleQuestion,
    accentClass: 'text-sky-300',
    theme: {
      icon: 'text-sky-200',
      iconBg: 'bg-gradient-to-br from-sky-500/30 to-cyan-500/20 ring-sky-400/30',
      trigger:
        'border-sky-500/25 bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-sky-500/5 hover:border-sky-400/40 hover:from-sky-500/15',
      glow: 'shadow-[0_0_20px_-6px_rgba(56,189,248,0.5)]',
      item: 'hover:bg-sky-500/10 data-[highlighted]:bg-sky-500/10',
      itemActive: 'bg-sky-500/15 ring-1 ring-sky-400/25'
    }
  },
  {
    id: 'planner',
    label: 'Планировщик',
    description: 'Изучает проект и составляет план без правок файлов',
    placeholder: 'Опишите задачу — получите пошаговый план...',
    requiresWorkspace: true,
    icon: Map,
    accentClass: 'text-amber-300',
    theme: {
      icon: 'text-amber-200',
      iconBg: 'bg-gradient-to-br from-amber-500/30 to-orange-500/20 ring-amber-400/30',
      trigger:
        'border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 hover:border-amber-400/40 hover:from-amber-500/15',
      glow: 'shadow-[0_0_20px_-6px_rgba(245,158,11,0.45)]',
      item: 'hover:bg-amber-500/10 data-[highlighted]:bg-amber-500/10',
      itemActive: 'bg-amber-500/15 ring-1 ring-amber-400/25'
    }
  }
]

export function getChatModeConfig(mode: ChatMode): ChatModeConfig {
  return CHAT_MODES.find((m) => m.id === mode) ?? CHAT_MODES[0]
}
