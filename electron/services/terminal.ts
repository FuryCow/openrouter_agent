import * as pty from 'node-pty'
import { EventEmitter } from 'events'

interface TerminalSession {
  pty: pty.IPty
}

export class TerminalService extends EventEmitter {
  private sessions = new Map<string, TerminalSession>()
  private shuttingDown = false

  onData(callback: (id: string, data: string) => void): void {
    this.on('data', callback)
  }

  create(cwd?: string): string {
    if (this.shuttingDown) {
      throw new Error('Terminal service is shutting down')
    }

    const id = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'

    const terminal = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || process.cwd(),
      env: process.env as Record<string, string>
    })

    terminal.onData((data) => {
      if (this.shuttingDown || !this.sessions.has(id)) return
      this.emit('data', id, data)
    })

    terminal.onExit(() => {
      this.sessions.delete(id)
    })

    this.sessions.set(id, { pty: terminal })
    return id
  }

  write(id: string, data: string): void {
    if (this.shuttingDown) return
    this.sessions.get(id)?.pty.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    if (this.shuttingDown) return
    this.sessions.get(id)?.pty.resize(cols, rows)
  }

  destroy(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    this.sessions.delete(id)
    try {
      session.pty.kill()
    } catch {
      // already exited
    }
  }

  destroyAll(): void {
    this.shuttingDown = true
    for (const id of [...this.sessions.keys()]) {
      this.destroy(id)
    }
    this.removeAllListeners('data')
  }

  async runCommand(command: string, cwd: string, timeoutMs = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
      const args =
        process.platform === 'win32'
          ? ['-NoProfile', '-Command', command]
          : ['-c', command]

      const terminal = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: process.env as Record<string, string>
      })

      let output = ''
      let settled = false

      const finish = (fn: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try {
          terminal.kill()
        } catch {
          // ignore
        }
        fn()
      }

      const timer = setTimeout(() => {
        finish(() => resolve(output || '(command timed out)'))
      }, timeoutMs)

      terminal.onData((data) => {
        output += data
      })

      terminal.onExit(({ exitCode }) => {
        finish(() => {
          if (exitCode !== 0 && !output.trim()) {
            reject(new Error(`Command exited with code ${exitCode}`))
          } else {
            resolve(output.trim() || '(no output)')
          }
        })
      })
    })
  }
}
