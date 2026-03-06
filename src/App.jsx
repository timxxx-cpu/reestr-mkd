import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { AuthService } from '@lib/auth-service';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from '@context/ToastContext';
import CatalogsAdminPanel from '@components/admin/CatalogsAdminPanel';
import { PersonaContext } from '@context/PersonaContext';
import LoginScreen from '@components/app/LoginScreen';
import ProjectEditorRoute from '@components/app/ProjectEditorRoute';
import MainLayout from '@components/app/MainLayout';
import ProjectProviderWrapper from '@components/app/ProjectProviderWrapper';

const DB_SCOPE = 'shared_dev_env';


export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [availablePersonas, setAvailablePersonas] = useState([]);
  const [activePersona, setActivePersona] = useState(null);

  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = AuthService.subscribe(u => {
      setFirebaseUser(u);
      setActivePersona(u);
      setAvailablePersonas(u ? [u] : []);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async credentials => {
    if (!credentials) return;
    setIsAuthLoading(true);
    try {
      const signedInUser = await AuthService.login(credentials.username, credentials.password);
      setFirebaseUser(signedInUser);
      setActivePersona(signedInUser);
      setAvailablePersonas([signedInUser]);
    } catch (error) {
      console.error('Login failed', error);
      alert(error?.message || 'Ошибка входа. Проверьте логин и пароль.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (!firebaseUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        isLoading={isAuthLoading}
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
