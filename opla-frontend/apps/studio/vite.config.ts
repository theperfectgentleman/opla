import * as path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localNodeModules = path.resolve(__dirname, 'node_modules')
const rootNodeModules = path.resolve(__dirname, '../../node_modules')

// https://vite.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, '../../..'),
  plugins: [
    react(),
  ],
  optimizeDeps: {
    include: [
      '@kanaries/graphic-walker',
      'mobx',
      'mobx-react-lite',
      'styled-components',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('echarts') || id.includes('zrender')) {
            return 'analytics-charts'
          }

          if (id.includes('@kanaries/graphic-walker')) {
            return 'analytics-walker'
          }

          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "util": path.resolve(__dirname, "./src/lib/browserUtil.ts"),
      "node:util": path.resolve(__dirname, "./src/lib/browserUtil.ts"),
      "react-native": path.resolve(localNodeModules, 'react-native-web'),
      "react": path.resolve(localNodeModules, 'react'),
      "react-dom/server": path.resolve(rootNodeModules, 'react-dom/server.browser.js'),
      "react-dom/server.js": path.resolve(rootNodeModules, 'react-dom/server.browser.js'),
      "react-dom/server.node": path.resolve(rootNodeModules, 'react-dom/server.browser.js'),
      "react-dom/server.node.js": path.resolve(rootNodeModules, 'react-dom/server.browser.js'),
      "react-dom/client": path.resolve(rootNodeModules, 'react-dom/client.js'),
      "mobx": path.resolve(rootNodeModules, 'mobx'),
      "mobx-react-lite": path.resolve(rootNodeModules, 'mobx-react-lite'),
      "react-dom": path.resolve(rootNodeModules, 'react-dom'),
    },
  },
})
