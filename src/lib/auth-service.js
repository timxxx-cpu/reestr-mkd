import { normalizeUserRole } from './roles';
const getBffBaseUrl = () => import.meta.env.VITE_BFF_BASE_URL || 'http://localhost:8787';

// Простой массив подписчиков для замены функционала Firebase onAuthStateChanged
let subscribers = [];


const readCachedUser = () => {
  const userStr = localStorage.getItem('current_user');
  if (!userStr) return null;

  try {
    return normalizeUserRole(JSON.parse(userStr));
  } catch {
    return null;
  }
};

export const AuthService = {
  // Реальный логин через бэкенд
  async login(username, password) {
    const res = await fetch(`${getBffBaseUrl()}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      let message = `Ошибка авторизации: ${res.status}`;
      try {
        const errorBody = await res.json();
        if (errorBody?.message) message = errorBody.message;
      } catch {
        // noop
      }
      throw new Error(message);
    }
    
    const data = await res.json();
    
    // Сохраняем токен
    const normalizedUser = normalizeUserRole(data.user);

    localStorage.setItem('jwt_token', data.token);
    localStorage.setItem('current_user', JSON.stringify(normalizedUser));
    
    // Уведомляем React (App.jsx), что пользователь вошел
    subscribers.forEach(cb => cb(normalizedUser));
    
    return normalizedUser;
  },

  logout() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    subscribers.forEach(cb => cb(null));
    window.location.reload();
  },

  getToken() {
    return localStorage.getItem('jwt_token');
  },

  getCurrentUser() {
    return readCachedUser();
  },

  // Метод, который использует App.jsx (useEffect) для прослушивания статуса
  subscribe(cb) {
    subscribers.push(cb);
    // При подписке сразу отдаем текущего юзера, если он есть в кэше
    cb(readCachedUser());
    return () => {
      subscribers = subscribers.filter(fn => fn !== cb);
    };
  }
};
