import { spawn } from 'child_process'

let rgPathPromise: Promise<string> | null = null

/** Spawn cannot run a binary packed inside app.asar. electron-builder copies it beside the archive. */
export function ripgrepExecutablePath(rgPath: string): string {
  if (rgPath.includes(`${'app.asar'}.unpacked`)) return rgPath
  return rgPath.replace('app.asar', 'app.asar.unpacked')
}

export async function getRgPath(): Promise<string> {
  if (!rgPathPromise) {
    rgPathPromise = import('@vscode/ripgrep').then((module) => ripgrepExecutablePath(module.rgPath))
  }
  return rgPathPromise
}

export async function runRipgrep(
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const rgPath = await getRgPath()
  return new Promise((resolve, reject) => {
    const child = spawn(rgPath, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ stdout, stderr, code }))
  })
}
