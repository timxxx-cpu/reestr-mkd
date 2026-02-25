import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ label = 'Список пуст', subLabel = 'Нет данных для отображения' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
        <Inbox size={32} className="opacity-50" />
      </div>
      <h3 className="text-sm font-bold text-slate-600">{label}</h3>
      <p className="text-xs mt-1">{subLabel}</p>
    </div>
  );
}
