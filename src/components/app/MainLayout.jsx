import React, { Suspense, lazy, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AuthService } from '@lib/auth-service';
import { useProjects } from '@hooks/useProjects';
import { DevRoleSwitcher } from '@components/app/DevRoleSwitcher';

const ApplicationsDashboard = lazy(() => import('@components/ApplicationsDashboard'));

export default function MainLayout({ activePersona, dbScope }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, isLoading, refetchProjects } = useProjects(dbScope);

  useEffect(() => {
    refetchProjects();
  }, [location.key, location.state, refetchProjects]);

  const handleLogout = async () => {
    await AuthService.logout();
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen bg-slate-50">
            <Loader2 className="animate-spin text-slate-400" />
          </div>
        }
      >
        <ApplicationsDashboard
          user={activePersona}
          projects={projects}
          dbScope={dbScope}
          onSelectProject={(id, mode) => navigate(`/project/${id}${mode === 'view' ? '?mode=view' : ''}`)}
          onLogout={handleLogout}
          onOpenCatalogs={() => navigate('/admin/catalogs')}
        />
      </Suspense>

      <DevRoleSwitcher disabled={false} />
    </div>
  );
}
