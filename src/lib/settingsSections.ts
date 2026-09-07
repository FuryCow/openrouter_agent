import type { LucideIcon } from 'lucide-react'
import { Bot, Database, Plug, Search, Settings2, Shield } from 'lucide-react'

export type SettingsSection = 'general' | 'agent' | 'safety' | 'search' | 'index' | 'mcp'

export interface SettingsSectionConfig {
  id: SettingsSection
  label: string
  description: string
  icon: LucideIcon
}

export const SETTINGS_SECTIONS: SettingsSectionConfig[] = [
  {
    id: 'general',
    label: 'General',
    description: 'API key and model defaults',
    icon: Settings2
  },
  {
    id: 'agent',
    label: 'Agent',
    description: 'Prompt and project memory',
    icon: Bot
  },
  {
    id: 'safety',
    label: 'Safety',
    description: 'Tool approval defaults',
    icon: Shield
  },
  {
    id: 'search',
    label: 'Web search',
    description: 'Search provider and keys',
    icon: Search
  },
  {
    id: 'index',
    label: 'Codebase index',
    description: 'Indexing and semantic search',
    icon: Database
  },
  {
    id: 'mcp',
    label: 'MCP',
    description: 'Model Context Protocol servers',
    icon: Plug
  }
]

export function getSettingsSection(id: SettingsSection): SettingsSectionConfig {
  return SETTINGS_SECTIONS.find((section) => section.id === id) ?? SETTINGS_SECTIONS[0]
}
