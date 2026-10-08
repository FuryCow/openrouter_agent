import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    // Bind explicitly to IPv4: Node 17+ resolves "localhost" to the first OS answer,
    // which can be ::1 (IPv6-only listener) while Electron connects to 127.0.0.1
    // -> ERR_CONNECTION_REFUSED -> permanent grey window.
    server: {
      host: '127.0.0.1',
      strictPort: true
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@app-icon': resolve('build/icon.png')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
