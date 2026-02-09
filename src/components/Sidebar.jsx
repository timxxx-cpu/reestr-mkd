import React, { useState } from 'react';
import {
  CheckCircle2,
  Lock,
  ChevronRight,
  LayoutDashboard,
  PieChart,
  Sun,
  Moon,
  AlertTriangle,
} from 'lucide-react';
import { STEPS_CONFIG, ROLES } from '@lib/constants';
import { useProject } from '@context/ProjectContext';
import { useTheme } from '@context/ThemeContext';
import { getStepStage } from '@lib/workflow-utils';
import { Button, Tooltip } from '@components/ui/UIKit';

// --- МОДАЛКА ВЫХОДА (ТОЛЬКО ДЛЯ КНОПКИ "НА РАБОЧИЙ СТОЛ") ---
const ExitConfirmationModal = ({ onCancel, onConfirm }) => (
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
          Если выйти на рабочий стол сейчас,{' '}
          <span className="font-bold text-red-600">все изменения будут потеряны</span>.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            onClick={onConfirm}
            className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 border-0 h-10"
          >
            Всё равно выйти
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

export default function Sidebar({
  currentStep,
  onStepChange,
  isOpen,
  onToggle,
  onBackToDashboard,
  maxAllowedStep,
}) {
  const { complexInfo, applicationInfo, userProfile, hasUnsavedChanges, setHasUnsavedChanges } =
    useProject();

  const { theme, setTheme } = useTheme();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const currentStage = applicationInfo?.currentStage || 1;
  const isProjectCompleted = applicationInfo?.status === 'COMPLETED';

  const completedList =
    userProfile?.role === ROLES.TECHNICIAN
      ? applicationInfo?.completedSteps || []
      : applicationInfo?.verifiedSteps || [];

  const totalSteps = STEPS_CONFIG.length;
  const completedStepsCount = STEPS_CONFIG.filter((_, idx) => {
    const sStage = getStepStage(idx);
    return isProjectCompleted || sStage < currentStage || completedList.includes(idx);
  }).length;

  const progressPercent = Math.round((completedStepsCount / totalSteps) * 100);

  // --- ЛОГИКА ВЫХОДА (Критическая зона) ---
  const handleDashboardClick = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true); // Здесь предупреждаем, т.к. данные сотрутся
    } else {
      onBackToDashboard();
    }
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    setHasUnsavedChanges(false);
    onBackToDashboard(true);
  };

  // --- ЛОГИКА НАВИГАЦИИ (Свободная зона) ---
  const handleStepClick = idx => {
    // Блокируем только если шаг недоступен по логике workflow
    if (idx === currentStep || idx > maxAllowedStep) return;

    // Мы просто переходим. Данные остаются в pendingUpdatesRef (в памяти).
    // Флаг hasUnsavedChanges останется true.
    onStepChange(idx);
  };

  return (
    <>
      {showExitConfirm && (
        <ExitConfirmationModal onCancel={() => setShowExitConfirm(false)} onConfirm={confirmExit} />
      )}

      <aside
        className={`fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800 shadow-xl z-40 transition-all duration-300 ease-in-out flex flex-col text-slate-300 ${isOpen ? 'w-72' : 'w-20'}`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900">
          <div
            className={`flex items-center gap-3 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
              <span className="font-bold text-sm">Р</span>
            </div>
            <span className="font-bold text-white tracking-tight text-sm">Реестр МКД</span>
          </div>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all ml-auto ${!isOpen && 'mx-auto'}`}
          >
            <ChevronRight
              size={18}
              className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {isOpen && (
          <div className="p-6 pb-2 animate-in fade-in duration-300">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Объект
            </div>
            <h2
              className="text-sm font-bold text-white leading-snug line-clamp-2"
              title={complexInfo?.name}
            >
              {complexInfo?.name || 'Новый проект'}
            </h2>
            <div className="text-xs text-slate-500 mt-1 truncate">
              {complexInfo?.street || 'Адрес не указан'}
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <button
            onClick={handleDashboardClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group mb-6 text-slate-400 hover:bg-slate-800 hover:text-white ${!isOpen && 'justify-center'}`}
            title="На рабочий стол"
          >
            <LayoutDashboard size={20} className="group-hover:text-blue-400 transition-colors" />
            <span
              className={`text-xs font-bold transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
            >
              На рабочий стол
            </span>
          </button>

          {isOpen && (
            <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Этапы работы
            </div>
          )}

          {STEPS_CONFIG.map((step, idx) => {
            const isActive = currentStep === idx;
            const isLocked = idx > maxAllowedStep;
            const stepStage = getStepStage(idx);

            const isVerified =
              isProjectCompleted || stepStage < currentStage || completedList.includes(idx);
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(idx)}
                disabled={isLocked}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group ${!isOpen && 'justify-center'} ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : isLocked ? 'text-slate-600 cursor-not-allowed opacity-40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title={step.title}
              >
                <div className="relative">
                  {isLocked ? (
                    <Lock size={20} className="text-slate-700" />
                  ) : (
                    <Icon
                      size={20}
                      className={`${isActive ? 'text-white' : isVerified ? 'text-emerald-500' : 'text-slate-500 group-hover:text-slate-300'} transition-colors`}
                    />
                  )}
                  {!isLocked && isVerified && !isActive && isOpen && (
                    <div className="absolute -top-1 -right-1 bg-slate-900 rounded-full p-0.5 shadow-sm ring-1 ring-slate-700">
                      <CheckCircle2 size={10} className="text-emerald-500" />
                    </div>
                  )}
                </div>
                <div
                  className={`text-left transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
                >
                  <div
                    className={`text-xs font-bold leading-none ${isActive ? 'text-white' : 'text-slate-300'}`}
                  >
                    {step.title}
                  </div>
                  {isLocked && (
                    <div className="text-[9px] text-slate-700 mt-1 font-medium tracking-wide">
                      Недоступно
                    </div>
                  )}
                </div>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-4">
          <div
            className={`transition-opacity duration-300 ${!isOpen ? 'opacity-0 hidden' : 'opacity-100'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <PieChart size={14} />
                <span>Прогресс</span>
              </div>
              <div className="text-xs font-bold text-white">{progressPercent}%</div>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-1">
              <div className="text-[10px] text-slate-600">
                {userProfile?.role === ROLES.TECHNICIAN ? 'Завершено шагов' : 'Проверено шагов'}
              </div>
              <div className="text-[10px] font-bold text-slate-500">
                {completedStepsCount} / {totalSteps}
              </div>
            </div>
          </div>

          <Tooltip
            content={
              theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'
            }
            placement="right"
          >
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 hover:bg-slate-800 text-slate-400 hover:text-white ${!isOpen && 'justify-center'}`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              <span
                className={`text-xs font-bold transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
              >
                {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
              </span>
            </button>
          </Tooltip>
        </div>
      </aside>
    </>
  );
}
