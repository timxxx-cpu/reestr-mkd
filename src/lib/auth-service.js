import { signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Сервис аутентификации.
 * Абстрагирует работу с Firebase Auth.
 */
export const AuthService = {
  /**
   * Анонимный вход (для демо/разработки)
   */
  signInDemo: async () => {
    try {
      return await signInAnonymously(auth);
    } catch (error) {
      console.error("Auth Error:", error);
      throw error;
    }
  },

  /**
   * Выход из системы
   */
  logout: async () => {
    await signOut(auth);
  },

  /**
   * Подписка на изменение статуса авторизации
   * @param {function(object|null): void} callback 
   * @returns {import('firebase/auth').Unsubscribe} Функция отписки
   */
  subscribe: (callback) => {
    return onAuthStateChanged(auth, (user) => {
      callback(user); 
    });
  },
  
  /**
   * Получить текущего юзера синхронно (если уже загружен)
   */
  getCurrentUser: () => auth.currentUser
};