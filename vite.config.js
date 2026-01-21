import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import packageJson from './package.json'

// Функция для получения хеша коммита
const getCommitHash = () => {
  try {
    // 1. Пытаемся взять локально через Git (для dev-режима)
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    // 2. Если Git недоступен (например, на Netlify), берем из переменной окружения
    // Netlify дает переменную COMMIT_REF
    return process.env.COMMIT_REF?.slice(0, 7) || 'dev-build';
  }
}

const commitHash = getCommitHash();
const buildDate = new Date().toLocaleString('ru-RU');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Создаем глобальные константы, доступные в React
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  }
})