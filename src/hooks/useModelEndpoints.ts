import { useEffect, useState } from 'react'
import type { ModelEndpoint } from '@/types'

const cache = new Map<string, ModelEndpoint[]>()
const inflight = new Map<string, Promise<ModelEndpoint[]>>()

function loadModelEndpoints(modelId: string): Promise<ModelEndpoint[]> {
  const cached = cache.get(modelId)
  if (cached) return Promise.resolve(cached)
  const pending = inflight.get(modelId)
  if (pending) return pending
  const request = window.api.models
    .endpoints(modelId)
    .then((list) => {
      cache.set(modelId, list)
      inflight.delete(modelId)
      return list
    })
    .catch((error: unknown) => {
      inflight.delete(modelId)
      throw error
    })
  inflight.set(modelId, request)
  return request
}

export function useModelEndpoints(modelId: string): {
  endpoints: ModelEndpoint[]
  loading: boolean
  failed: boolean
} {
  const [endpoints, setEndpoints] = useState<ModelEndpoint[]>(() => cache.get(modelId) ?? [])
  const [loading, setLoading] = useState(Boolean(modelId) && !cache.has(modelId))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!modelId) {
      setEndpoints([])
      setLoading(false)
      setFailed(false)
      return
    }

    const cached = cache.get(modelId)
    if (cached) {
      setEndpoints(cached)
      setLoading(false)
      setFailed(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setFailed(false)
    loadModelEndpoints(modelId)
      .then((list) => {
        if (cancelled) return
        setEndpoints(list)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setEndpoints([])
        setFailed(true)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [modelId])

  return { endpoints, loading, failed }
}
