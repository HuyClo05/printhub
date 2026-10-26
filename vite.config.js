import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('occt-import-js')) return 'open-cascade'
          if (id.includes('three-bvh-csg')) return 'csg-tools'
          if (id.includes('three-mesh-bvh')) return 'mesh-bvh'
          if (id.includes('/three/')) return 'three-core'
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor'
          return undefined
        }
      }
    }
  }
})
