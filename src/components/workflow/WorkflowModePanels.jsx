import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { Button, SaveIndicator } from '@components/ui/UIKit';
import { IdentifierBadge } from '@components/ui/IdentifierBadge';
import { STEPS_CONFIG } from '@lib/constants';

export const ReviewModePanel = ({ onOpenHistory, onReject, onApprove, isLoading }) => (
  <div className="bg-indigo-900 border-b border-indigo-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl animate-in slide-in-from-top-2 text-white">
    <div className="flex items-center gap-4">
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck size={12} /> Контроль качества
        </span>
        <span className="text-base font-bold text-white tracking-tight">Проверка этапа</span>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        onClick={onOpenHistory}
        className="text-indigo-300 hover:text-white hover:bg-white/10 px-2 h-9"
        title="История действий"
      >
        <History size={18} />
      </Button>
      <div className="h-8 w-px bg-indigo-700 mx-1"></div>
      <Button
        onClick={onReject}
        disabled={isLoading}
        className="bg-white text-red-600 hover:bg-red-50 border border-transparent shadow-sm h-10 px-4"
      >
        <XCircle size={16} className="mr-2" /> Вернуть
      </Button>
      <Button
        onClick={onApprove}
        disabled={isLoading}
        className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/20 h-10 px-6 border-0"
      >
        <ThumbsUp size={16} className="mr-2" /> Принять этап
      </Button>
    </div>
  </div>
);

export const ManagerPendingDeclinePanel = ({ applicationInfo, onOpenHistory, onReturn, onConfirm, isLoading }) => (
  <div className="bg-amber-900 border-b border-amber-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl animate-in slide-in-from-top-2 text-white">
    <div className="flex items-center gap-4">
      <div className="p-2 bg-amber-800 rounded-xl border border-amber-700">
        <Clock size={20} className="text-amber-300" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Запрос на отказ от техника</span>
        <span className="text-base font-bold text-white tracking-tight">
          {applicationInfo.requestedDeclineBy || 'Техник'}: {applicationInfo.requestedDeclineReason || 'Причина не указана'}
        </span>
        <span className="text-[10px] text-amber-400 mt-0.5">
          Шаг: {STEPS_CONFIG[applicationInfo.requestedDeclineStep]?.title || 'Не указан'}
        </span>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        onClick={onOpenHistory}
        className="text-amber-300 hover:text-white hover:bg-white/10 px-2 h-9"
        title="История действий"
      >
        <History size={18} />
      </Button>
      <div className="h-8 w-px bg-amber-700 mx-1"></div>
      <Button
        onClick={onReturn}
        disabled={isLoading}
        className="bg-white text-amber-700 hover:bg-amber-50 border border-transparent shadow-sm h-10 px-4"
      >
        <ArrowLeft size={16} className="mr-2" /> Вернуть на доработку
      </Button>
      <Button
        onClick={onConfirm}
        disabled={isLoading}
        className="bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-900/20 h-10 px-6 border-0"
      >
        <Ban size={16} className="mr-2" /> Подтвердить отказ
      </Button>
    </div>
  </div>
);

export const TechnicianPendingDeclinePanel = ({ onOpenHistory, onExit }) => (
  <div className="bg-amber-900 border-b border-amber-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl animate-in slide-in-from-top-2 text-white">
    <div className="flex items-center gap-4">
      <div className="p-2 bg-amber-800 rounded-xl border border-amber-700">
        <Clock size={20} className="text-amber-300 animate-pulse" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Ожидание решения</span>
        <span className="text-sm font-bold text-white tracking-tight">
          Заявление направлено начальнику филиала для рассмотрения отказа
        </span>
        <span className="text-[10px] text-amber-400 mt-0.5">Данные доступны только для просмотра. Ожидайте решения.</span>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        onClick={onOpenHistory}
        className="h-9 px-3 text-xs bg-amber-800 border border-amber-700 hover:bg-amber-700 text-amber-300 hover:text-white"
      >
        <History size={14} className="mr-2" /> История
      </Button>
      <Button
        variant="ghost"
        onClick={onExit}
        className="h-9 px-3 text-xs bg-amber-800 border border-amber-700 hover:bg-amber-700 text-amber-300 hover:text-white"
      >
        <LogOut size={14} className="mr-2" /> Выйти
      </Button>
    </div>
  </div>
);

export const ActiveTechnicianTaskPanel = ({
  canGoBack,
  isIntegrationStage,
  isActionDisabled,
  onRollback,
  projectCode,
  currentStep,
  onOpenHistory,
  onExitWithoutSave,
  canTechRequestDecline,
  onRequestDecline,
  onSave,
  isCustomSaveStep,
  hasUnsavedChanges,
  isLoading,
  onSaveAndExit,
  onComplete,
  isStageBoundary,
  actionBtnText,
}) => (
  <div className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl shadow-slate-900/10 animate-in slide-in-from-top-2 text-white">
    <div className="flex items-center gap-4">
      {canGoBack && !isIntegrationStage && (
        <Button
          variant="ghost"
          onClick={onRollback}
          disabled={isActionDisabled}
          className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9 border border-transparent"
          title="Вернуться на шаг назад"
        >
          <ArrowLeft size={18} />
        </Button>
      )}
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Текущая задача</span>
          {projectCode && (
            <IdentifierBadge
              code={projectCode}
              type="project"
              variant="compact"
              className="bg-blue-600/20 border-blue-400/30 text-blue-200"
            />
          )}
        </div>
        <span className="text-base font-bold text-white tracking-tight">{STEPS_CONFIG[currentStep]?.title}</span>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        onClick={onOpenHistory}
        disabled={isActionDisabled}
        className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9"
        title="История действий"
      >
        <History size={18} />
      </Button>

      <div className="h-8 w-px bg-slate-700 mx-1"></div>

      <Button
        variant="ghost"
        onClick={onExitWithoutSave}
        disabled={isActionDisabled}
        className={`text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 h-10 border border-transparent transition-colors text-xs font-bold ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Выйти без сохранения
      </Button>

      {canTechRequestDecline && (
        <Button
          variant="ghost"
          onClick={onRequestDecline}
          disabled={isActionDisabled}
          className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 px-3 h-10 border border-transparent transition-colors text-xs font-bold"
          title="Запросить отказ заявления"
        >
          <Ban size={14} className="mr-1.5" />
          Запросить отказ
        </Button>
      )}

      <Button
        onClick={onSave}
        disabled={isActionDisabled || isCustomSaveStep}
        title={isCustomSaveStep ? 'Сохранение выполняется в форме ниже' : 'Ctrl+S'}
        className={`relative h-10 shadow-sm transition-all border ${
          hasUnsavedChanges && !isCustomSaveStep
            ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 ring-2 ring-blue-500/30'
            : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
        }`}
      >
        {!isCustomSaveStep && <SaveIndicator hasChanges={hasUnsavedChanges} />}
        {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
        {isLoading ? 'Сохранение...' : 'Сохранить'}
      </Button>

      <Button
        variant="secondary"
        onClick={onSaveAndExit}
        disabled={isActionDisabled || isCustomSaveStep}
        title="Ctrl+Shift+S"
        className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white h-10 shadow-sm"
      >
        {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <LogOut size={16} className="mr-2" />}
        {isLoading ? 'Сохранение...' : 'Сохранить и Выйти'}
      </Button>

      <div className="h-8 w-px bg-slate-700 mx-1"></div>

      <Button
        onClick={onComplete}
        disabled={isActionDisabled}
        title="Ctrl+Enter"
        className={`${isStageBoundary ? 'bg-indigo-500 hover:bg-indigo-400 shadow-indigo-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'} text-white shadow-lg h-10 px-6 active:scale-95 transition-transform border-0`}
      >
        {actionBtnText}
        <ArrowRight size={16} className="ml-2 opacity-80" />
      </Button>
    </div>
  </div>
);

export const ReadOnlyCompletedPanel = ({ onOpenHistory, onExit }) => (
  <div className="bg-slate-900 border-b border-slate-800 px-8 py-3 flex justify-between items-center sticky top-0 z-30 animate-in slide-in-from-top-2 text-slate-300">
    <div className="flex items-center gap-4">
      <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-500">
        <CheckCircle2 size={16} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Статус</span>
        <span className="text-sm font-bold text-slate-300">Задача выполнена (Режим просмотра)</span>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        onClick={onOpenHistory}
        className="h-9 px-3 text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white"
      >
        <History size={14} className="mr-2" /> История
      </Button>
      <Button
        variant="ghost"
        onClick={onExit}
        className="h-9 px-3 text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white"
      >
        <LogOut size={14} className="mr-2" /> Выйти
      </Button>
    </div>
  </div>
);
