import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      hyparquet: fromHere('./node_modules/hyparquet'),
      'hyparquet-compressors': fromHere('./node_modules/hyparquet-compressors'),
      fzstd: fromHere('./node_modules/fzstd'),
      hysnappy: fromHere('./node_modules/hysnappy'),
    },
  },
  server: {
    fs: {
      allow: [fromHere('../..')],
    },
  },
})
