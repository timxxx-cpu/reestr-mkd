import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
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
  define: {
    // ВАЖНО: JSON.stringify обязателен, иначе Vite вставит сырой текст и сломает JS
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  }
})