/// <reference types="vite/client" />

declare module '@app-icon' {
  const src: string
  export default src
}

import type { ElectronAPI } from '../electron/preload'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
