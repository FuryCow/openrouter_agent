import type { McpServerConfig } from '../types'
import { validateMcpServerConfigs } from './mcp-config'

export async function runMcpServerTest(
  server: McpServerConfig,
  testServer: (
    server: McpServerConfig
  ) => Promise<{ ok: boolean; toolCount: number; error?: string }>,
  message: (key: string, values?: Record<string, unknown>) => string
): Promise<{ type: 'success' | 'error'; message: string }> {
  const validationError = validateMcpServerConfigs([server])
  if (validationError) {
    throw validationError
  }

  const result = await testServer(server)
  if (!result.ok) {
    return { type: 'error', message: result.error ?? message('mcp.testFailed') }
  }

  return {
    type: 'success',
    message: message('mcp.testSuccess', { count: result.toolCount })
  }
}
