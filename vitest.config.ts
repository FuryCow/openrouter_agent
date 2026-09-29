import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'electron/**/*.test.ts', 'shared/**/*.test.ts']
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      // The app source lives in ./electron, which collides with the electron package.
      { find: /^electron$/, replacement: path.resolve(__dirname, 'node_modules/electron/index.js') }
    ]
  }
})
