import type { TFunction } from 'i18next'
import type { LucideIcon } from 'lucide-react'
import { Bot, Database, Plug, Search, Settings2, Shield } from 'lucide-react'

export type SettingsSection = 'general' | 'agent' | 'safety' | 'search' | 'index' | 'mcp'

export interface SettingsSectionConfig {
  id: SettingsSection
  label: string
  description: string
  icon: LucideIcon
}

const SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
  general: Settings2,
  agent: Bot,
  safety: Shield,
  search: Search,
  index: Database,
  mcp: Plug
}

const SECTION_IDS: SettingsSection[] = ['general', 'agent', 'safety', 'search', 'index', 'mcp']

export function getSettingsSections(t: TFunction<'settings'>): SettingsSectionConfig[] {
  return SECTION_IDS.map((id) => ({
    id,
    label: t(`sections.${id}.label`),
    description: t(`sections.${id}.description`),
    icon: SECTION_ICONS[id]
  }))
}

export function getSettingsSection(id: SettingsSection, t: TFunction<'settings'>): SettingsSectionConfig {
  return getSettingsSections(t).find((section) => section.id === id) ?? getSettingsSections(t)[0]
}
