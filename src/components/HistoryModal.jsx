import React, { useEffect, useRef } from 'react';
import { X, Clock, MessageSquare, ArrowRight, User } from 'lucide-react';
import { APP_STATUS_LABELS } from '@lib/constants';

export default function HistoryModal({ history, onClose }) {
  const modalRef = useRef(null);

  // Keyboard navigation: Escape для закрытия
  useEffect(() => {
    const handleEscape = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Автофокус на модалку при открытии
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
        onClick={e => e.stopPropagation()}
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] focus:outline-none"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-500 shadow-sm">
              <Clock size={20} />
            </div>
            <div>
              <h3 id="history-modal-title" className="font-bold text-slate-800 text-lg">
                История событий
              </h3>
              <p className="text-xs text-slate-500">Журнал изменений статуса проекта</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть модальное окно истории"
            className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-200"
          >
            <X size={18} className="text-slate-400 hover:text-slate-700" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
          {(!history || history.length === 0) && (
            <div className="text-center py-12 text-slate-400 text-sm">История пуста</div>
          )}

          {history?.map((item, idx) => {
            const statusConfig = APP_STATUS_LABELS[item.action] || {
              label: item.action,
              color: 'bg-slate-100 text-slate-600',
            };
            const prevStatusConfig = APP_STATUS_LABELS[item.prevStatus];

            return (
              <div
                key={idx}
                className="relative pl-6 pb-6 last:pb-0 border-l border-slate-200 last:border-0"
              >
                {/* Timeline Dot */}
                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-white border-2 border-slate-300"></div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm -mt-1.5">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span className="font-mono">{new Date(item.date).toLocaleDateString()}</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-mono">
                        {new Date(item.date).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                      <User size={10} />
                      {item.user}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    {prevStatusConfig && (
                      <>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase opacity-60 ${prevStatusConfig.color.replace('border-', 'border-transparent ')}`}
                        >
                          {prevStatusConfig.label}
                        </span>
                        <ArrowRight size={12} className="text-slate-300" />
                      </>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {item.comment && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-600 flex gap-2">
                      <MessageSquare size={14} className="shrink-0 mt-0.5 text-slate-400" />
                      <span className="italic">«{item.comment}»</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
