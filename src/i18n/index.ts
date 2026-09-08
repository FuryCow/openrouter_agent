import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from './locales/en/common.json'
import chat from './locales/en/chat.json'
import settings from './locales/en/settings.json'
import explorer from './locales/en/explorer.json'
import layout from './locales/en/layout.json'
import errors from './locales/en/errors.json'
import tools from './locales/en/tools.json'

export const I18N_NAMESPACES = ['common', 'chat', 'settings', 'explorer', 'layout', 'errors', 'tools'] as const
export type I18nNamespace = (typeof I18N_NAMESPACES)[number]

export const DEFAULT_LOCALE = 'en'

void i18n.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  ns: [...I18N_NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  resources: {
    en: {
      common,
      chat,
      settings,
      explorer,
      layout,
      errors,
      tools
    }
  }
})

export { i18n }

export async function setAppLocale(locale: string): Promise<void> {
  await i18n.changeLanguage(locale || DEFAULT_LOCALE)
}
