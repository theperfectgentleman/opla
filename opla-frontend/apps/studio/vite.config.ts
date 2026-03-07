import * as path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localNodeModules = path.resolve(__dirname, 'node_modules')
const rootNodeModules = path.resolve(__dirname, '../../node_modules')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@syncfusion/ej2-react-spreadsheet')) {
            return 'analytics-spreadsheet'
          }

          if (id.includes('@syncfusion/ej2-react-pivotview')) {
            return 'analytics-pivot'
          }

          if (id.includes('@syncfusion/ej2-base')) {
            return 'analytics-syncfusion-license'
          }

          if (id.includes('echarts') || id.includes('zrender')) {
            return 'analytics-charts'
          }

          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react-native": path.resolve(localNodeModules, 'react-native-web'),
      "react": path.resolve(localNodeModules, 'react'),
      "react-dom/client": path.resolve(rootNodeModules, 'react-dom/client.js'),
      "react-dom": path.resolve(rootNodeModules, 'react-dom'),
    },
  },
})
