import React, { useEffect, useState } from 'react';
import { AlertTriangle, Ban, X } from 'lucide-react';
import { ROLES } from '@lib/constants';
import { Button, useEscapeKey } from '@components/ui/UIKit';
import { ACTION_MODAL_INTENT_STYLES } from './config';

export default function DashboardActionModal({ config, onCancel, onConfirm, technicians = [] }) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  useEscapeKey(onCancel);

  useEffect(() => {
    if (config.type === 'select' && technicians.length > 0 && !inputValue) {
      setInputValue(technicians[0].code || technicians[0].name);
    }
  }, [config.type, technicians, inputValue]);

  const handleSubmit = () => {
    const trimmed = typeof inputValue === 'string' ? inputValue.trim() : inputValue;

    if (config.type === 'input') {
      if (config.required && !trimmed) {
        setError('Это поле обязательно для заполнения');
        return;
      }
      if (config.minLength && trimmed.length < config.minLength) {
        setError(`Минимальная длина комментария: ${config.minLength} символов`);
        return;
      }
    }

    onConfirm(trimmed);
  };

  const intentStyle = ACTION_MODAL_INTENT_STYLES[config.intent] || ACTION_MODAL_INTENT_STYLES.default;
  const HeaderIcon = config.intent === 'destructive' && config.type !== 'confirm' ? Ban : intentStyle.icon;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200 flex flex-col">
        <div className={`px-6 py-4 border-b flex items-center gap-3 ${intentStyle.headerBg}`}>
          <div className={`p-2 rounded-full shadow-sm border ${intentStyle.iconColor}`}>
            <HeaderIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight">{config.title}</h3>
            {config.subtitle && <p className="text-xs text-slate-500 font-medium">{config.subtitle}</p>}
          </div>
          <button onClick={onCancel} className="ml-auto text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {config.description && <p className="text-sm text-slate-600 leading-relaxed">{config.description}</p>}

          {config.type === 'input' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {config.label || 'Комментарий'} {config.required && <span className="text-red-500">*</span>}
              </label>
              <textarea
                autoFocus
                className={`w-full min-h-[100px] p-3 rounded-xl border text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all resize-none ${
                  error
                    ? 'border-red-300 ring-red-100 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                }`}
                placeholder={config.placeholder}
                value={inputValue}
                onChange={e => {
                  setInputValue(e.target.value);
                  if (error) setError('');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
                }}
              />
              {error && (
                <div className="text-xs text-red-600 flex items-center gap-1 animate-in slide-in-from-top-1">
                  <AlertTriangle size={12} /> {error}
                </div>
              )}
              {config.minLength > 0 && (
                <div className="text-[10px] text-right text-slate-400">
                  {inputValue.length} / {config.minLength} символов
                </div>
              )}
            </div>
          )}

          {config.type === 'select' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {config.label || 'Выберите вариант'}
              </label>
              <select
                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-100 transition-all"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
              >
              {technicians.map(tech => (
                  <option key={tech.code || tech.id || tech.name} value={tech.code || tech.name}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} className="h-10">
            Отмена
          </Button>
          <Button onClick={handleSubmit} className={`h-10 text-white shadow-lg border-0 ${intentStyle.buttonClass}`}>
            {config.confirmText || 'Подтвердить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
