import { useTranslation } from 'react-i18next'
import { getChatModeConfig, getChatModeConfigs, type ChatMode, type ChatModeConfig } from '@/lib/chatModes'

export function useChatModes(): {
  modes: ChatModeConfig[]
  getModeConfig: (mode: ChatMode) => ChatModeConfig
} {
  const { t } = useTranslation('chat')
  return {
    modes: getChatModeConfigs(t),
    getModeConfig: (mode: ChatMode) => getChatModeConfig(mode, t)
  }
}
