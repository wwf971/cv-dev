import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  plugins: [
    vue(),
    UnoCSS(),
    {
      name: 'redirect-root',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(302, { Location: '/main.html' })
            res.end()
          } else {
            next()
          }
        })
      }
    }
  ],
  server: {
    port: 5201,
    open: 'public/main.html'
  },
  build: {
    outDir: 'build',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'public/main.html'),
        // test: path.resolve(__dirname, 'public/test.html')
      },
      external: ['vue', 'axios'],
      output: {
        format: 'iife', // iife的input:{xxx}只允许有1个entry 
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