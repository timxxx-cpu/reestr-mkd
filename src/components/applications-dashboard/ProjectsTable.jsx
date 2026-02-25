import React from 'react';
import { TableSkeleton } from '@components/ui/UIKit';
import ProjectRow from './ProjectRow';
import EmptyState from './EmptyState';

export default function ProjectsTable({
  data,
  user,
  onSelect,
  onDelete,
  onDecline,
  onReturnFromDecline,
  onReassign,
  isLoading = false,
  viewOnly = false,
}) {
  if (!isLoading && data.length === 0) return <EmptyState />;

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-t-2xl shadow-[0_0_15px_rgba(0,0,0,0.05)] border border-slate-200/60">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-sm border-collapse relative">
          <thead className="bg-slate-900 text-slate-300 sticky top-0 z-20 shadow-lg">
            <tr>
              <th className="px-4 py-4 w-12 text-center text-[10px] font-bold uppercase tracking-wider opacity-60">#</th>
              <th className="px-4 py-4 w-32 text-center text-[10px] font-bold uppercase tracking-wider">UJ-код</th>
              <th className="px-4 py-4 w-40 text-center text-[10px] font-bold uppercase tracking-wider">Кадастровый №</th>
              <th className="px-4 py-4 w-[18%] text-left text-[10px] font-bold uppercase tracking-wider">Заявка / Источник</th>
              <th className="px-4 py-4 w-[22%] text-left text-[10px] font-bold uppercase tracking-wider">Объект и Адрес</th>
              <th className="px-4 py-4 w-[20%] text-left text-[10px] font-bold uppercase tracking-wider">Процесс</th>
              <th className="px-4 py-4 w-[12%] text-center text-[10px] font-bold uppercase tracking-wider">Статус</th>
              <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-wider">Действия</th>
            </tr>
          </thead>

          {isLoading ? (
            <TableSkeleton rows={5} cols={8} />
          ) : (
            <tbody className="divide-y divide-slate-100">
              {data.map((project, idx) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  idx={idx}
                  user={user}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onDecline={onDecline}
                  onReturnFromDecline={onReturnFromDecline}
                  onReassign={onReassign}
                  viewOnly={viewOnly}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
