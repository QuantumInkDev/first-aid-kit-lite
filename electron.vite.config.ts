import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main'
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload'
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
        '@assets': resolve('src/assets'),
        '@': resolve('src/renderer'),
        '@/components': resolve('src/renderer/components'),
        '@/lib': resolve('src/renderer/lib'),
        '@/hooks': resolve('src/renderer/hooks')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist/renderer'
    },
  }
})