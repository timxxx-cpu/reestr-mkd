import React from 'react';

export default function DashboardToolbar({
  currentList,
  projectsTotal,
  projectsPage,
  projectsTotalPages,
  projectsPageSize,
  isFetchingProjects,
  onPrevPage,
  onNextPage,
}) {
  return (
    <div className="px-4 py-2 border-b border-slate-200 bg-white/80 flex items-center justify-between text-xs text-slate-600">
      <span>Показано: {currentList.length} из {projectsTotal}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevPage}
          disabled={projectsPage <= 1 || isFetchingProjects}
          className="h-8 px-3 rounded-md border border-slate-200 disabled:opacity-40"
        >
          Назад
        </button>
        <span className="font-semibold">Стр. {projectsPage}{projectsTotalPages > 0 ? ` / ${projectsTotalPages}` : ''}</span>
        <button
          onClick={onNextPage}
          disabled={
            isFetchingProjects ||
            (projectsTotalPages > 0
              ? projectsPage >= projectsTotalPages
              : projectsPage * projectsPageSize >= projectsTotal && projectsTotal > 0)
          }
          className="h-8 px-3 rounded-md border border-slate-200 disabled:opacity-40"
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
