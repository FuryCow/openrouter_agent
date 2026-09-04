export function usdPerMillionFromApiValue(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null
  const perToken = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(perToken)) return null
  return perToken * 1_000_000
}

export function formatUsdPerMillion(value: number | null): string {
  if (value === null) return '—'
  if (value === 0) return 'Free'
  if (value >= 100) return `$${value.toFixed(0)}`
  if (value >= 10) return `$${value.toFixed(1)}`
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.1) return `$${value.toFixed(3)}`
  if (value >= 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(6)}`
}

export function buildPriceLabel(
  promptPricePerM: number | null,
  completionPricePerM: number | null
): string {
  const input = formatUsdPerMillion(promptPricePerM)
  const output = formatUsdPerMillion(completionPricePerM)
  return `${input} in · ${output} out / 1M`
}

export function formatModelPricing(
  promptPricePerM: number | null | undefined,
  completionPricePerM: number | null | undefined
): { input: string; output: string; combined: string } {
  const input = formatUsdPerMillion(promptPricePerM ?? null)
  const output = formatUsdPerMillion(completionPricePerM ?? null)
  return {
    input,
    output,
    combined: `${input} in · ${output} out / 1M`
  }
}
