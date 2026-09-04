import { join } from 'path'

type TransformersModule = typeof import('@xenova/transformers')
type FeatureExtractionPipeline = Awaited<ReturnType<TransformersModule['pipeline']>>

let transformersModule: TransformersModule | null = null
let embedder: FeatureExtractionPipeline | null = null
let loading: Promise<FeatureExtractionPipeline> | null = null
let cacheConfigured = false

async function getTransformers(): Promise<TransformersModule> {
  if (!transformersModule) {
    transformersModule = await import('@xenova/transformers')
  }
  return transformersModule
}

export async function configureEmbeddingCache(cacheDir: string): Promise<void> {
  const { env } = await getTransformers()
  env.cacheDir = cacheDir
  env.allowLocalModels = true
  cacheConfigured = true
}

async function ensureCache(userDataPath: string): Promise<void> {
  if (cacheConfigured) return
  await configureEmbeddingCache(getEmbeddingCacheDir(userDataPath))
}

export async function loadEmbedder(
  modelName: string,
  userDataPath?: string
): Promise<FeatureExtractionPipeline> {
  if (userDataPath) await ensureCache(userDataPath)
  if (embedder) return embedder
  if (!loading) {
    loading = (async () => {
      const { pipeline } = await getTransformers()
      return pipeline('feature-extraction', modelName, { quantized: true })
    })()
  }
  embedder = await loading
  return embedder
}

export async function embedTexts(
  modelName: string,
  texts: string[],
  userDataPath?: string
): Promise<number[][]> {
  if (texts.length === 0) return []
  const pipe = await loadEmbedder(modelName, userDataPath)
  const vectors: number[][] = []
  const batchSize = 16

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const output = await pipe(batch, { pooling: 'mean', normalize: true })
    const list = output.tolist() as number[][] | number[][][]
    if (Array.isArray(list[0]?.[0])) {
      for (const row of list as number[][][]) {
        vectors.push(row[0])
      }
    } else {
      vectors.push(...(list as number[][]))
    }
  }

  return vectors
}

export function getEmbeddingCacheDir(userDataPath: string): string {
  return join(userDataPath, 'models')
}
