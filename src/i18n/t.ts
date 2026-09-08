import { i18n } from './index'
import type { I18nNamespace } from './index'

export function getT(ns?: I18nNamespace) {
  return ns ? i18n.getFixedT(i18n.language, ns) : i18n.t.bind(i18n)
}

export function getLocale(): string {
  return i18n.language || 'en'
}

export function formatNumber(value: number): string {
  return value.toLocaleString(getLocale())
}

export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(getLocale())
}
