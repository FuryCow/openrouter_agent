import type { ModelInfo } from '../types'
import { apiFetch } from './http'

const API_BASE = 'https://openrouter.ai/api/v1'

interface OpenRouterModelRaw {
  id: string
  name: string
  description?: string
  context_length?: number | null
  architecture?: {
    input_modalities?: string[]
    output_modalities?: string[]
    modality?: string
  }
  supported_parameters?: string[]
  pricing?: {
    prompt?: string | number
    completion?: string | number
  }
  benchmarks?: {
    artificial_analysis?: {
      agentic_index?: number | null
    }
  }
}

interface ModelsListResponse {
  data: OpenRouterModelRaw[]
  links?: { next?: string | null }
  total_count?: number
}

function usdPerMillionFromApiValue(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null
  const perToken = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(perToken)) return null
  return perToken * 1_000_000
}

function formatUsdPerMillion(value: number | null): string {
  if (value === null) return '—'
  if (value === 0) return 'Free'
  if (value >= 100) return `$${value.toFixed(0)}`
  if (value >= 10) return `$${value.toFixed(1)}`
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.1) return `$${value.toFixed(3)}`
  if (value >= 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(6)}`
}

function buildPriceLabel(
  promptPricePerM: number | null,
  completionPricePerM: number | null
): string {
  return `${formatUsdPerMillion(promptPricePerM)} in · ${formatUsdPerMillion(completionPricePerM)} out / 1M`
}

function formatContextLength(tokens: number | null | undefined): string | undefined {
  if (!tokens) return undefined
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return String(tokens)
}

function hasVisionSupport(raw: OpenRouterModelRaw): boolean {
  const modalities = raw.architecture?.input_modalities ?? []
  if (modalities.includes('image')) return true
  const modality = raw.architecture?.modality ?? ''
  return modality.includes('image')
}

function hasToolsSupport(raw: OpenRouterModelRaw): boolean {
  const params = raw.supported_parameters ?? []
  return params.includes('tools') || params.includes('tool_choice')
}

function normalizeModel(raw: OpenRouterModelRaw): ModelInfo | null {
  const inputModalities = raw.architecture?.input_modalities ?? []
  const outputModalities = raw.architecture?.output_modalities ?? []
  const supportsTools = hasToolsSupport(raw)
  const supportsVision = hasVisionSupport(raw)

  if (!supportsTools) return null
  if (outputModalities.length > 0 && !outputModalities.includes('text')) return null

  const promptPricePerM = usdPerMillionFromApiValue(raw.pricing?.prompt)
  const completionPricePerM = usdPerMillionFromApiValue(raw.pricing?.completion)
  const agenticIndex = raw.benchmarks?.artificial_analysis?.agentic_index ?? null

  return {
    id: raw.id,
    name: raw.name || raw.id,
    description: raw.description,
    contextLength: raw.context_length ?? undefined,
    contextLabel: formatContextLength(raw.context_length),
    inputModalities,
    outputModalities,
    supportsTools,
    supportsVision,
    agenticIndex,
    promptPricePerM,
    completionPricePerM,
    priceLabel: buildPriceLabel(promptPricePerM, completionPricePerM)
  }
}

export type ModelSort = 'price-low' | 'price-high' | 'agentic' | 'name'

export function sortModels(models: ModelInfo[], sort: ModelSort = 'price-low'): ModelInfo[] {
  return [...models].sort((a, b) => {
    switch (sort) {
      case 'price-low': {
        const priceA = a.promptPricePerM ?? Number.POSITIVE_INFINITY
        const priceB = b.promptPricePerM ?? Number.POSITIVE_INFINITY
        if (priceA !== priceB) return priceA - priceB
        return a.name.localeCompare(b.name)
      }
      case 'price-high': {
        const priceA = a.promptPricePerM ?? -1
        const priceB = b.promptPricePerM ?? -1
        if (priceB !== priceA) return priceB - priceA
        return a.name.localeCompare(b.name)
      }
      case 'agentic': {
        const agenticA = a.agenticIndex ?? -1
        const agenticB = b.agenticIndex ?? -1
        if (agenticB !== agenticA) return agenticB - agenticA
        return a.name.localeCompare(b.name)
      }
      case 'name':
      default:
        return a.name.localeCompare(b.name)
    }
  })
}

async function fetchModelPage(
  url: string,
  headers: Record<string, string>
): Promise<ModelsListResponse> {
  const response = await apiFetch(url, { headers })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenRouter models error: ${response.status} ${body.slice(0, 200)}`)
  }
  return (await response.json()) as ModelsListResponse
}

async function fetchAllRawModels(headers: Record<string, string>): Promise<OpenRouterModelRaw[]> {
  const collected: OpenRouterModelRaw[] = []
  const seenIds = new Set<string>()
  let offset = 0
  const limit = 1000

  while (true) {
    const params = new URLSearchParams({
      supported_parameters: 'tools',
      output_modalities: 'text',
      sort: 'pricing-low-to-high'
    })
    params.set('offset', String(offset))
    params.set('limit', String(limit))

    const payload = await fetchModelPage(`${API_BASE}/models?${params.toString()}`, headers)
    let added = 0

    for (const raw of payload.data) {
      if (seenIds.has(raw.id)) continue
      seenIds.add(raw.id)
      collected.push(raw)
      added++
    }

    const total = payload.total_count ?? collected.length
    if (payload.data.length < limit || collected.length >= total || added === 0) {
      break
    }

    offset += payload.data.length
  }

  return collected
}

export interface FetchModelsOptions {
  visionOnly?: boolean
  freeOnly?: boolean
  sort?: ModelSort
}

export async function fetchAgentModels(
  apiKey?: string,
  options: FetchModelsOptions = {}
): Promise<ModelInfo[]> {
  const { visionOnly = false, freeOnly = false, sort = 'price-low' } = options

  const headers: Record<string, string> = {
    'HTTP-Referer': 'https://openrouter-agent.local',
    'X-Title': 'OpenRouter Agent',
    'User-Agent': 'OpenRouterAgent/1.0'
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const rawModels = await fetchAllRawModels(headers)
  const models: ModelInfo[] = []

  for (const raw of rawModels) {
    const model = normalizeModel(raw)
    if (!model) continue
    if (visionOnly && !model.supportsVision) continue
    if (freeOnly && model.promptPricePerM !== 0) continue
    models.push(model)
  }

  return sortModels(models, sort)
}

export const fetchAgentVisionModels = fetchAgentModels
