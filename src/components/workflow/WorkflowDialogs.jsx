import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  MessageSquare,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react';
import { Button, useEscapeKey } from '@components/ui/UIKit';

// --- МОДАЛКА ДЛЯ ВВОДА КОММЕНТАРИЯ/ПРИЧИНЫ (ВЗАМЕН PROMPT) ---
export const ActionCommentModal = ({ config, onCancel, onConfirm, isLoading }) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  
  useEscapeKey(onCancel);

  const handleSubmit = () => {
    const trimmed = comment.trim();
    
    if (config.required && !trimmed) {
      setError('Это поле обязательно для заполнения');
      return;
    }
    
    if (config.minLength && trimmed.length < config.minLength) {
      setError(`Минимальная длина комментария: ${config.minLength} символов`);
      return;
    }

    onConfirm(trimmed);
  };

  const isDestructive = config.intent === 'destructive';
  const isWarning = config.intent === 'warning';
  
  // Определение цветов и иконок в зависимости от intent
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
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center gap-3 ${headerBg}`}>
          <div className={`p-2 rounded-full shadow-sm border ${iconColor}`}>
            <HeaderIcon size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight">{config.title}</h3>
            {config.subtitle && (
              <p className="text-xs text-slate-500 font-medium">{config.subtitle}</p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
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
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
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
                {comment.length} / {config.minLength} символов
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading} className="h-10">
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className={`h-10 text-white shadow-lg border-0 ${btnClass}`}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            {config.confirmText || 'Подтвердить'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- МОДАЛКА ОШИБОК ВАЛИДАЦИИ ---
export const ValidationErrorsModal = ({ errors, onClose }) => {
  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-full text-red-500 shadow-sm border border-red-100">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900">Обнаружены ошибки</h3>
              <p className="text-xs text-red-600 font-medium">
                Необходимо исправить {errors.length} проблем(ы) перед продолжением
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-red-400 hover:text-red-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
          <div className="space-y-3">
            {errors.map((err, idx) => (
              <div
                key={idx}
                className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-red-50/30 hover:border-red-100 transition-colors"
              >
                <div className="mt-0.5 min-w-[20px] text-center font-bold text-xs text-slate-400">
                  {idx + 1}.
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-800 leading-tight mb-1">
                    {err.title}
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">{err.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg px-6"
          >
            Понятно, исправлю
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- МОДАЛКА ВЫХОДА ---
export const ExitConfirmationModal = ({ onCancel, onConfirm }) => {
  useEscapeKey(onCancel);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-red-50/50">
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">
            Несохраненные изменения
          </h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            У вас есть данные, которые не были сохранены.
            <br />
            Если выйти сейчас,{' '}
            <span className="font-bold text-red-600">все изменения будут потеряны</span>.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={onConfirm}
              className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 border-0 h-10"
            >
              Да, выйти без сохранения
            </Button>
            <Button
              variant="ghost"
              onClick={onCancel}
              className="w-full text-slate-500 hover:text-slate-800 h-10"
            >
              Отмена
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- МОДАЛКА ВОЗВРАТА НА ПРЕДЫДУЩУЮ ЗАДАЧУ ---
export const RollbackConfirmationModal = ({
  currentStepTitle,
  prevStepTitle,
  onCancel,
  onConfirm,
  isLoading,
}) => {
  useEscapeKey(onCancel);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white text-amber-600 border border-amber-200 flex items-center justify-center">
            <ArrowLeft size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">Возврат к предыдущей задаче</h3>
            <p className="text-[11px] text-slate-600">Проверьте параметры перед подтверждением</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <div>
              <span className="font-bold text-slate-500">Текущая задача:</span> {currentStepTitle}
            </div>
            <div className="mt-1">
              <span className="font-bold text-slate-500">После возврата:</span> {prevStepTitle}
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Система выполнит возврат на предыдущий шаг. Перед возвратом будут сохранены текущие
            изменения.
          </p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
            Статус задачи будет обновлен в соответствии с Workflow и записан в историю действий.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel} className="flex-1 h-10" disabled={isLoading}>
              Отмена
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 size={14} className="animate-spin mr-2" />
              ) : (
                <ArrowLeft size={14} className="mr-2" />
              )}
              Подтвердить возврат
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- МОДАЛКА ПОДТВЕРЖДЕНИЯ ПРИНЯТИЯ ЭТАПА (ДЛЯ БРИГАДИРА) ---
export const ApproveStageModal = ({ stageNum, onCancel, onConfirm, isLoading }) => {
  useEscapeKey(onCancel);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-emerald-100 bg-emerald-50 flex items-center gap-3">
          <div className="p-2 bg-white rounded-full text-emerald-600 shadow-sm border border-emerald-100">
            <ThumbsUp size={18} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-900 leading-tight">
              Подтвердить принятие этапа
            </h3>
            <p className="text-xs text-emerald-700">Проверка бригадиром</p>
          </div>
        </div>

        <div className="p-6 text-sm text-slate-700 space-y-3">
          <p>
            Вы подтверждаете, что <span className="font-bold">Этап {stageNum}</span> проверен и
            принят.
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            После подтверждения система сохранит решение и переведет процесс к следующему этапу.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading} className="h-10">
            Отмена
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : (
              <ThumbsUp size={16} className="mr-2" />
            )}
            Подтвердить
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- МОДАЛКА ЗАВЕРШЕНИЯ ЗАДАЧИ ---
export const CompleteTaskModal = ({ onCancel, onConfirm, message }) => {
  useEscapeKey(onCancel);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/50">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">
            Завершение задачи
          </h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed px-2">
            {message}
            <br />
            <span className="opacity-70 mt-2 block font-medium">
              Данные будут сохранены автоматически.
            </span>
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={onConfirm}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 border-0 h-10"
            >
              Да, завершить
            </Button>
            <Button
              variant="ghost"
              onClick={onCancel}
              className="w-full text-slate-500 hover:text-slate-800 h-10"
            >
              Отмена
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SaveProgressModal = ({ status, message, onOk }) => {
  const isSaving = status === 'saving';
  const isError = status === 'error';

  useEscapeKey(!isSaving ? onOk : null);

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
        <div className="p-6 text-center">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ${isError ? 'bg-red-50 text-red-500 ring-red-50/60' : 'bg-blue-50 text-blue-600 ring-blue-50/60'}`}
          >
            {isSaving ? (
              <Loader2 size={26} className="animate-spin" />
            ) : isError ? (
              <XCircle size={26} />
            ) : (
              <CheckCircle2 size={26} />
            )}
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">
            {isSaving
              ? 'Идет запись данных'
              : isError
                ? 'Запись не произведена'
                : 'Запись выполнена'}
          </h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">{message}</p>
          {/* Кнопка ОК показывается только при ошибке или если нужен ручной выход (для обратной совместимости) */}
          {!isSaving && (
            <Button
              onClick={onOk}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-10"
            >
              ОК
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
