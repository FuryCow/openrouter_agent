import type { ModelInfo } from '@/types'
import { formatModelPricing } from '@/lib/pricing'

type LegacyModelInfo = ModelInfo & {
  promptPrice?: number | null
  completionPrice?: number | null
}

export function getModelPriceLabel(model: ModelInfo): string {
  if (model.priceLabel) return model.priceLabel

  if (model.promptPricePerM != null || model.completionPricePerM != null) {
    return formatModelPricing(model.promptPricePerM, model.completionPricePerM).combined
  }

  const legacy = model as LegacyModelInfo
  if (legacy.promptPrice != null || legacy.completionPrice != null) {
    return formatModelPricing(legacy.promptPrice ?? null, legacy.completionPrice ?? null).combined
  }

  return 'Price unavailable — restart via start.bat'
}

export function isStaleModelCatalog(models: ModelInfo[]): boolean {
  if (models.length === 0) return false
  if (models.length <= 50) {
    const hasPricing = models.some(
      (m) =>
        Boolean(m.priceLabel) ||
        m.promptPricePerM != null ||
        m.completionPricePerM != null
    )
    if (!hasPricing) return true
  }
  return false
}
