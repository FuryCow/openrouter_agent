import { net } from 'electron'

function formatNetworkError(error: unknown): Error {
  if (error instanceof Error) {
    const cause = error.cause as (Error & { code?: string }) | undefined
    const parts: string[] = []

    if (error.message && error.message !== 'fetch failed') {
      parts.push(error.message)
    } else {
      parts.push('Network request failed')
    }

    if (cause?.code) parts.push(cause.code)
    if (cause?.message && cause.message !== error.message) parts.push(cause.message)

    return new Error(parts.join(' — '))
  }

  return new Error(String(error))
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await net.fetch(input, init)
  } catch (error) {
    throw formatNetworkError(error)
  }
}
