import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
  base: '/sample/',
  build: {
    outDir: path.resolve(__dirname, '../src/main/resources/static/sample'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
})
