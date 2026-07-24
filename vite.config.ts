import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Bundle analysis only when building
    visualizer({
      filename: 'dist/stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
      'dompurify',
      'leaflet',
      '@radix-ui/react-select',
    ],
  },
  server: {
    port: 5173,
    host: true,
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/pages/Dashboard.tsx',
        './src/components/study/TraditionalTalmudDaf.tsx',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:7030',
        changeOrigin: true,
        secure: false,
      },
      '/admin': {
        target: 'http://localhost:7030',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/admin/, '/api/admin')
      }
    }
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          radix: ['@radix-ui/react-select'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  esbuild: mode === 'production' ? {
    drop: ['console', 'debugger'],
  } : {},
}))