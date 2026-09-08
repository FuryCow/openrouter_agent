import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { McpServerConfig, McpStatusSnapshot } from '@/types'

export function useMcp(): {
  status: McpStatusSnapshot
  config: McpServerConfig[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  saveConfig: (servers: McpServerConfig[]) => Promise<void>
  importDefaultCursor: () => Promise<McpServerConfig[]>
  importFromFile: () => Promise<McpServerConfig[] | null>
  testServer: (config: McpServerConfig) => Promise<{ ok: boolean; toolCount: number; error?: string }>
  reconnect: () => Promise<void>
} {
  const [status, setStatus] = useState<McpStatusSnapshot>({
    servers: [],
    totalTools: 0,
    connectedCount: 0,
    enabledCount: 0
  })
  const [config, setConfig] = useState<McpServerConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation('settings')

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [nextStatus, nextConfig] = await Promise.all([
        window.api.mcp.getStatus(),
        window.api.mcp.getConfig()
      ])
      setStatus(nextStatus)
      setConfig(nextConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mcp.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
    const unsubscribe = window.api.mcp.onStatusChanged((next) => {
      setStatus(next)
    })
    return unsubscribe
  }, [refresh])

  const saveConfig = useCallback(async (servers: McpServerConfig[]): Promise<void> => {
    setError(null)
    const saved = await window.api.mcp.saveConfig(servers)
    setConfig(saved)
    setStatus(await window.api.mcp.getStatus())
  }, [])

  const importDefaultCursor = useCallback(async (): Promise<McpServerConfig[]> => {
    setError(null)
    const imported = await window.api.mcp.importDefaultCursor()
    setConfig(imported)
    return imported
  }, [])

  const importFromFile = useCallback(async (): Promise<McpServerConfig[] | null> => {
    setError(null)
    const imported = await window.api.mcp.importFromFile()
    if (imported) setConfig(imported)
    return imported
  }, [])

  const testServer = useCallback(
    (serverConfig: McpServerConfig) => window.api.mcp.testServer(serverConfig),
    []
  )

  const reconnect = useCallback(async (): Promise<void> => {
    setError(null)
    setStatus(await window.api.mcp.reconnect())
  }, [])

  return {
    status,
    config,
    loading,
    error,
    refresh,
    saveConfig,
    importDefaultCursor,
    importFromFile,
    testServer,
    reconnect
  }
}
