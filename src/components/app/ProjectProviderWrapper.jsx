import React from 'react';
import { useParams } from 'react-router-dom';
import { ProjectProvider } from '@context/ProjectContext';
import AppErrorBoundary from '@components/app/AppErrorBoundary';

export default function ProjectProviderWrapper({ children, firebaseUser, dbScope, activePersona }) {
  const { projectId } = useParams();

  return (
    <ProjectProvider
      key={projectId}
      projectId={projectId}
      user={firebaseUser}
      customScope={dbScope}
      userProfile={activePersona}
    >
      <AppErrorBoundary onReset={() => (window.location.href = '/')}>{children}</AppErrorBoundary>
    </ProjectProvider>
  );
}
