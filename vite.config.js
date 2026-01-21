import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import packageJson from './package.json'

// Генерируем "умную" версию
const getAutoVersion = () => {
  try {
    // 1. Берем базу руками из package.json (например, 1.0.0)
    const baseVersion = packageJson.version;
    
    // 2. Считаем количество коммитов в Git (автоматический счетчик)
    // "git rev-list --count HEAD" вернет просто число (например, 42)
    const commitCount = execSync('git rev-list --count HEAD').toString().trim();
    
    // 3. Склеиваем: 1.0.0.42
    return `${baseVersion}.${commitCount}`;
  } catch (e) {
    // Если Git недоступен, возвращаем просто версию + дату
    return `${packageJson.version}-dev`;
  }
}

// Получаем короткий хеш (как раньше)
const getCommitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    return process.env.COMMIT_REF?.slice(0, 7) || 'local';
  }
}

const appVersion = getAutoVersion();
const commitHash = getCommitHash();

export default defineConfig({
  plugins: [react()],
  define: {
    // Теперь __APP_VERSION__ — это длинная автоматическая строка
    __APP_VERSION__: JSON.stringify(appVersion),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  }
})