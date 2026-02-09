// src/lib/auth-service.js
export const AuthService = {
  // Эмуляция входа
  signInDemo: async (persona = null) => {
    const user = {
      uid: persona?.id || 'test-user-id',
      email: 'dev@reestr.uz',
      displayName: persona?.name || 'Разработчик',
      role: persona?.role || 'admin',
      personaId: persona?.id || null,
    };
    localStorage.setItem('mock_user', JSON.stringify(user));
    return user;
  },

  logout: async () => {
    localStorage.removeItem('mock_user');
    window.location.reload();
  },

  // Эмуляция подписки на состояние
  subscribe: callback => {
    const saved = localStorage.getItem('mock_user');
    const user = saved ? JSON.parse(saved) : null;

    // Сразу возвращаем юзера (или null)
    callback(user);

    // Возвращаем пустую функцию отписки
    return () => {};
  },

  getCurrentUser: () => {
    const saved = localStorage.getItem('mock_user');
    return saved ? JSON.parse(saved) : null;
  },
};
