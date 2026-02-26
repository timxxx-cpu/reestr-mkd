import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { ApiService } from '@lib/api-service';
import { AuthService } from '@lib/auth-service';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@context/ToastContext';
import CatalogsAdminPanel from '@components/admin/CatalogsAdminPanel';
import { PersonaContext } from '@context/PersonaContext';
import LoginScreen from '@components/app/LoginScreen';
import ProjectEditorRoute from '@components/app/ProjectEditorRoute';
import MainLayout from '@components/app/MainLayout';

const DB_SCOPE = 'shared_dev_env';


export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [availablePersonas, setAvailablePersonas] = useState([]);

  const [activePersona, setActivePersona] = useState(() => {
    try {
      const saved = localStorage.getItem('dev_active_persona');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Ошибка чтения роли из storage', e);
    }
    return null;
  });

  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      setIsUsersLoading(true);
      try {
        const users = await ApiService.getSystemUsers();
        if (!mounted) return;
        setAvailablePersonas(users);

        if (users.length > 0) {
          setActivePersona(prev => prev || users[0]);
        }
      } catch (e) {
        console.error('Не удалось загрузить пользователей из БД', e);
        if (mounted) setAvailablePersonas([]);
      } finally {
        if (mounted) setIsUsersLoading(false);
      }
    };

    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activePersona || availablePersonas.length === 0) return;
    const fresh = availablePersonas.find(u => u.id === activePersona.id);
    if (!fresh) return;

    const changed =
      fresh.name !== activePersona.name ||
      fresh.role !== activePersona.role ||
      fresh.group !== activePersona.group;

    if (changed) setActivePersona(fresh);
  }, [availablePersonas, activePersona]);

  useEffect(() => {
    if (activePersona) {
      localStorage.setItem('dev_active_persona', JSON.stringify(activePersona));
    }
  }, [activePersona]);

  useEffect(() => {
    const unsubscribe = AuthService.subscribe(u => {
      setFirebaseUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async selectedPersona => {
    if (!selectedPersona) return;
    setIsAuthLoading(true);
    try {
      // Вызываем реальный логин и передаем .code (это 'timur_admin', 'abdu_manager' и т.д.)
      const signedInUser = await AuthService.login(selectedPersona.code);
      setFirebaseUser(signedInUser);
      setActivePersona(selectedPersona);
    } catch (error) {
      console.error('Login failed', error);
      // Опционально: можно добавить вывод ошибки пользователю
      alert('Ошибка входа. Сервер недоступен или неверный код.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (!firebaseUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isLoading={isAuthLoading}
        users={availablePersonas}
        usersLoading={isUsersLoading}
      />
    );
  }

  if (!activePersona) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <PersonaContext.Provider value={{ activePersona, setActivePersona, availablePersonas }}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<MainLayout activePersona={activePersona} dbScope={DB_SCOPE} />} />
          <Route path="/admin/catalogs" element={<CatalogsAdminPanel />} />
          <Route
            path="/project/:projectId"
            element={
              <ProjectProviderWrapper
                firebaseUser={firebaseUser}
                dbScope={DB_SCOPE}
                activePersona={activePersona}
              >
                <ProjectEditorRoute user={activePersona} />
              </ProjectProviderWrapper>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </PersonaContext.Provider>
  );
}