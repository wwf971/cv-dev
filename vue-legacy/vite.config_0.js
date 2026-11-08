import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'public/main.html'),
        test: path.resolve(__dirname, 'public/test.html')
      },
      external: ['vue', 'axios'],
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        globals: {
          vue: 'Vue',
          axios: 'axios'
        }
      }
    }
  },
  base: './',
  define: {
    'process.env.NODE_ENV': '"production"'
  }
})