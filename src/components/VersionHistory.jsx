import React, { useMemo, useState } from 'react';
import { X, RotateCcw, CheckCircle2, Ban } from 'lucide-react';
import { VersionBadge } from './ui/VersionBadge';
import { useEscapeKey } from './ui/UIKit';

const JsonPreview = ({ data }) => (
  <pre className="text-[11px] leading-relaxed bg-slate-950 text-slate-100 rounded-xl p-3 overflow-auto max-h-56">
    {JSON.stringify(data || {}, null, 2)}
  </pre>
);

export const VersionHistory = ({
  open,
  onClose,
  versions = [],
  onApprove,
  onDecline,
  onRestore,
  loading = false,
}) => {
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(() => {
    if (!selectedId) return versions[0] || null;
    return versions.find(v => v.id === selectedId) || versions[0] || null;
  }, [versions, selectedId]);

  useEscapeKey(open ? onClose : null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">История версий</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-12 min-h-[420px]">
          <div className="col-span-4 border-r border-slate-200 p-3 space-y-2 max-h-[70vh] overflow-auto">
            {versions.length === 0 ? (
              <div className="text-xs text-slate-500 p-3">Версии пока не созданы.</div>
            ) : (
              versions.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={`w-full text-left border rounded-xl p-3 transition ${selected?.id === v.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-xs text-slate-800">Версия #{v.version_number}</div>
                    <VersionBadge status={v.version_status} compact />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {v.created_by || '—'} • {new Date(v.created_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="col-span-8 p-4 space-y-3">
            {selected ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">Версия #{selected.version_number}</div>
                    <div className="text-xs text-slate-500">
                      {selected.entity_type} • {selected.entity_id}
                    </div>
                  </div>
                  <VersionBadge
                    status={selected.version_status}
                    versionNumber={selected.version_number}
                    createdBy={selected.created_by}
                    createdAt={selected.created_at}
                  />
                </div>

                <JsonPreview data={selected.snapshot_data} />

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => onRestore?.(selected)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Восстановить
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecline?.(selected)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Ban size={14} /> Отклонить
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove?.(selected)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Утвердить
                  </button>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500">Нет данных по версии.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
