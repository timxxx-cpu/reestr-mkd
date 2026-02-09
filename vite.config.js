import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { resolve } from 'path'
import packageJson from './package.json'

// Безопасная функция получения 
const getVersionInfo = () => {
  try {
    // Пытаемся получить хеш из Git
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    return hash;
  } catch (e) {
    // Если ошибка (нет git, нет репозитория) — возвращаем заглушку
    return 'dev';
  }
}

// Получаем дату сборки
const getBuildDate = () => {
    return new Date().toLocaleString('ru-RU');
}

const commitHash = getVersionInfo();
const buildDate = getBuildDate();

export default defineConfig({
  plugins: [react()],
  
  // Path aliases для удобных импортов
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@lib': resolve(__dirname, './src/lib'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@context': resolve(__dirname, './src/context'),
    }
  },
  
  define: {
    // ВАЖНО: JSON.stringify обязателен, иначе Vite вставит сырой текст и сломает JS
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  
  // Code splitting для оптимизации загрузки
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI библиотеки
          'vendor-ui': ['lucide-react', 'recharts'],
          // Data management
          'vendor-data': ['@tanstack/react-query', '@tanstack/react-virtual', '@supabase/supabase-js'],
          // Validation
          'vendor-utils': ['zod']
        }
      }
    },
    // Увеличиваем лимит для предупреждений (у нас много компонентов)
    chunkSizeWarningLimit: 600
  },
  
  // Удаление console.log в production
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
})