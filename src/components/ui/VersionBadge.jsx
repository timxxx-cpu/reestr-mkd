import React from 'react';
import { VERSION_STATUS_LABELS } from '@lib/constants';

export const VersionBadge = ({
  status,
  versionNumber,
  createdBy,
  createdAt,
  className = '',
  compact = false,
}) => {
  const cfg = VERSION_STATUS_LABELS[status] || {
    label: status || '—',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const tooltip = [
    versionNumber ? `Версия: ${versionNumber}` : null,
    createdBy ? `Создал: ${createdBy}` : null,
    createdAt ? `Дата: ${new Date(createdAt).toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <span
      title={tooltip || undefined}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.color} ${className}`}
    >
      {!compact && versionNumber ? <span className="opacity-80">v{versionNumber}</span> : null}
      <span>{cfg.label}</span>
    </span>
  );
};
