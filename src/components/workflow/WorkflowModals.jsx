import React, { useState } from 'react';
import { AlertTriangle, X, Ban, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { Button, useEscapeKey } from '@components/ui/UIKit';

export const ActionCommentModal = ({ config, onCancel, onConfirm, isLoading }) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  useEscapeKey(onCancel);

  const handleSubmit = () => {
    const trimmed = comment.trim();
    if (config.required && !trimmed) return setError('Это поле обязательно для заполнения');
    if (config.minLength && trimmed.length < config.minLength) {
      return setError(`Минимальная длина комментария: ${config.minLength} символов`);
    }
    onConfirm(trimmed);
  };

  const isDestructive = config.intent === 'destructive';
  const isWarning = config.intent === 'warning';
  let HeaderIcon = MessageSquare;
  let headerBg = 'bg-slate-50 border-slate-100';
  let iconColor = 'text-slate-600 bg-white';
  let btnClass = 'bg-slate-900 hover:bg-slate-800';
  if (isDestructive) {
    HeaderIcon = Ban;
    headerBg = 'bg-red-50 border-red-100';
    iconColor = 'text-red-600 bg-white border-red-100';
    btnClass = 'bg-red-600 hover:bg-red-700';
  } else if (isWarning) {
    HeaderIcon = AlertTriangle;
    headerBg = 'bg-amber-50 border-amber-100';
    iconColor = 'text-amber-600 bg-white border-amber-100';
    btnClass = 'bg-amber-600 hover:bg-amber-700';
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200 flex flex-col">
        <div className={`px-6 py-4 border-b flex items-center gap-3 ${headerBg}`}>
          <div className={`p-2 rounded-full shadow-sm border ${iconColor}`}><HeaderIcon size={20} /></div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight">{config.title}</h3>
            {config.subtitle && <p className="text-xs text-slate-500 font-medium">{config.subtitle}</p>}
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm font-medium text-slate-700">{config.label}</p>
          <div className="space-y-2">
            <textarea
              className={`w-full rounded-xl border p-3 text-sm text-slate-700 outline-none transition resize-none min-h-[96px] ${error ? 'border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-blue-100'}`}
              placeholder={config.placeholder}
              value={comment}
              onChange={e => { setComment(e.target.value); if (error) setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
            />
            {error && <div className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {error}</div>}
            {config.minLength > 0 && <div className="text-[10px] text-right text-slate-400">{comment.length} / {config.minLength} символов</div>}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading} className="h-10">Отмена</Button>
          <Button onClick={handleSubmit} disabled={isLoading} className={`h-10 text-white shadow-lg border-0 ${btnClass}`}>
            {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            {config.confirmText || 'Подтвердить'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ValidationErrorsModal = ({ errors, onClose }) => {
  useEscapeKey(onClose);
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-full text-red-500 shadow-sm border border-red-100"><AlertTriangle size={20} /></div>
            <div>
              <h3 className="text-lg font-bold text-red-900">Обнаружены ошибки</h3>
              <p className="text-xs text-red-600 font-medium">Необходимо исправить {errors.length} проблем(ы) перед продолжением</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-red-400 hover:text-red-700"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar bg-white space-y-3">
          {errors.map((err, idx) => (
            <div key={idx} className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="mt-0.5 min-w-[20px] text-center font-bold text-xs text-slate-400">{idx + 1}.</div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-800 leading-tight mb-1">{err.title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{err.description}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end">
          <Button onClick={onClose} className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg px-6">Понятно, исправлю</Button>
        </div>
      </div>
    </div>
  );
};

export const ExitConfirmationModal = ({ onCancel, onConfirm }) => {
  useEscapeKey(onCancel);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
        <div className="p-6 text-center">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-red-50/50"><AlertTriangle size={28} /></div>
          <h3 className="text-lg font-black text-slate-800 mb-2">Несохраненные изменения</h3>
          <p className="text-xs text-slate-500 mb-6">Если выйти сейчас, <span className="font-bold text-red-600">все изменения будут потеряны</span>.</p>
          <div className="flex flex-col gap-2">
            <Button onClick={onConfirm} className="w-full bg-red-600 hover:bg-red-700 text-white h-10">Да, выйти без сохранения</Button>
            <Button variant="ghost" onClick={onCancel} className="w-full text-slate-500 hover:text-slate-800 h-10">Отмена</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RollbackConfirmationModal = ({ currentStep, onCancel, onConfirm, isLoading, isFirstStep }) => {
  useEscapeKey(onCancel);
  const targetStep = Math.max(0, currentStep - 1);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
        <div className="p-6 border-b border-slate-100 bg-amber-50 text-center">
          <div className="w-14 h-14 bg-white text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-amber-100/80"><AlertTriangle size={26} /></div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Откатить этап?</h3>
          <p className="text-sm text-slate-600">{isFirstStep ? 'Вы находитесь на первом шаге. Откат невозможен.' : `Текущий этап будет откатан на шаг ${targetStep + 1}.`}</p>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading} className="h-10">Отмена</Button>
          <Button onClick={onConfirm} disabled={isLoading || isFirstStep} className="h-10 bg-amber-600 hover:bg-amber-700 text-white">
            {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}Подтвердить откат
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ApproveStageModal = ({ stageNum, onCancel, onConfirm, isLoading }) => {
  useEscapeKey(onCancel);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
        <div className="p-6 border-b border-emerald-100 bg-emerald-50 text-center">
          <div className="w-14 h-14 bg-white text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-100/80"><CheckCircle2 size={26} /></div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Принять этап {stageNum}?</h3>
          <p className="text-sm text-slate-600">После подтверждения этап будет принят и заявка перейдет к следующему этапу workflow.</p>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading} className="h-10">Отмена</Button>
          <Button onClick={onConfirm} disabled={isLoading} className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white">
            {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}Принять этап
          </Button>
        </div>
      </div>
    </div>
  );
};

export const CompleteTaskModal = ({ onCancel, onConfirm, message }) => {
  useEscapeKey(onCancel);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
        <div className="p-6 text-center">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-blue-100/70"><CheckCircle2 size={26} /></div>
          <h3 className="text-lg font-black text-slate-800 mb-2">Подтверждение действия</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">{message}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={onConfirm} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10">Да, продолжить</Button>
            <Button variant="ghost" onClick={onCancel} className="w-full text-slate-500 hover:text-slate-800 h-10">Отмена</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SaveProgressModal = ({ status, message, onOk }) => {
  const isError = status === 'error';
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
        <div className="p-6 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 shadow-sm ${isError ? 'bg-red-50 text-red-600 ring-red-100/70' : 'bg-blue-50 text-blue-600 ring-blue-100/70'}`}>
            {isError ? <AlertTriangle size={26} /> : <Loader2 size={26} className="animate-spin" />}
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2">{isError ? 'Ошибка' : 'Выполняется...'}</h3>
          <p className="text-sm text-slate-600 mb-6">{message}</p>
          {isError && <Button onClick={onOk} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-10">Понятно</Button>}
        </div>
      </div>
    </div>
  );
};
