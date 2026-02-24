const getBffBaseUrl = () => import.meta.env.VITE_BFF_BASE_URL || 'http://localhost:8787';

// Простой массив подписчиков для замены функционала Firebase onAuthStateChanged
let subscribers = [];

export const AuthService = {
  // Реальный логин через бэкенд
  async login(username) {
    const res = await fetch(`${getBffBaseUrl()}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    if (!res.ok) throw new Error(`Ошибка авторизации: ${res.status}`);
    
    const data = await res.json();
    
    // Сохраняем токен
    localStorage.setItem('jwt_token', data.token);
    localStorage.setItem('current_user', JSON.stringify(data.user));
    
    // Уведомляем React (App.jsx), что пользователь вошел
    subscribers.forEach(cb => cb(data.user));
    
    return data.user;
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

  // Метод, который использует App.jsx (useEffect) для прослушивания статуса
  subscribe(cb) {
    subscribers.push(cb);
    // При подписке сразу отдаем текущего юзера, если он есть в кэше
    const userStr = localStorage.getItem('current_user');
    if (userStr) {
      cb(JSON.parse(userStr));
    } else {
      cb(null);
    }
    return () => {
      subscribers = subscribers.filter(fn => fn !== cb);
    };
  }
};