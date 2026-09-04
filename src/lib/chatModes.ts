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
}

export const CHAT_MODES: ChatModeConfig[] = [
  {
    id: 'agent',
    label: 'Агент',
    description: 'Читает, пишет файлы, запускает команды и использует инструменты',
    placeholder: 'Попросите агента что-то сделать в проекте...',
    requiresWorkspace: true,
    icon: Bot,
    accentClass: 'text-indigo-400'
  },
  {
    id: 'ask',
    label: 'ASK',
    description: 'Ответы на вопросы без изменений в проекте',
    placeholder: 'Задайте вопрос о коде, технологиях или задаче...',
    requiresWorkspace: false,
    icon: MessageCircleQuestion,
    accentClass: 'text-sky-400'
  },
  {
    id: 'planner',
    label: 'Планировщик',
    description: 'Изучает проект и составляет план без правок файлов',
    placeholder: 'Опишите задачу — получите пошаговый план...',
    requiresWorkspace: true,
    icon: Map,
    accentClass: 'text-amber-400'
  }
]

export function getChatModeConfig(mode: ChatMode): ChatModeConfig {
  return CHAT_MODES.find((m) => m.id === mode) ?? CHAT_MODES[0]
}
