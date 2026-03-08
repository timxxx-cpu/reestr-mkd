import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import packageJson from './package.json'

const getVersionInfo = () => {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim()
    return hash
  } catch (e) {
    return 'dev'
  }
}

const getBuildDate = () => {
  return new Date().toLocaleString('ru-RU')
}

const getManualChunkName = id => {
  if (!id.includes('node_modules')) return undefined

  if (
    id.includes('\\react\\') ||
    id.includes('/react/') ||
    id.includes('\\react-dom\\') ||
    id.includes('/react-dom/') ||
    id.includes('\\react-router-dom\\') ||
    id.includes('/react-router-dom/')
  ) {
    return 'vendor-react'
  }

  if (
    id.includes('\\lucide-react\\') ||
    id.includes('/lucide-react/') ||
    id.includes('\\recharts\\') ||
    id.includes('/recharts/')
  ) {
    return 'vendor-ui'
  }

  if (
    id.includes('\\@tanstack\\react-query\\') ||
    id.includes('/@tanstack/react-query/') ||
    id.includes('\\@tanstack\\react-virtual\\') ||
    id.includes('/@tanstack/react-virtual/')
  ) {
    return 'vendor-data'
  }

  if (id.includes('\\zod\\') || id.includes('/zod/')) {
    return 'vendor-utils'
  }

  if (
    id.includes('\\maplibre-gl\\') ||
    id.includes('/maplibre-gl/') ||
    id.includes('\\react-map-gl\\') ||
    id.includes('/react-map-gl/')
  ) {
    return 'vendor-map'
  }

  if (
    id.includes('\\shpjs\\') ||
    id.includes('/shpjs/') ||
    id.includes('\\proj4\\') ||
    id.includes('/proj4/')
  ) {
    return 'vendor-shapefile'
  }

  return undefined
}

const commitHash = getVersionInfo();
const buildDate = getBuildDate();
const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(rootDir, './src'),
      '@components': resolve(rootDir, './src/components'),
      '@lib': resolve(rootDir, './src/lib'),
      '@hooks': resolve(rootDir, './src/hooks'),
      '@context': resolve(rootDir, './src/context'),
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualChunkName
      }
    },
    // The map stack is intentionally isolated and lazy-loaded, so a slightly higher threshold avoids noisy warnings.
    chunkSizeWarningLimit: 850
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
  }
}))
