import React from 'react';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-12 px-4' : 'py-16 px-4'} ${className}`}
    >
      {Icon && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
          <Icon size={compact ? 32 : 42} className="text-slate-300" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-base font-bold text-slate-700 mb-1.5">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-md">{description}</p>}
    </div>
  );
}
