import React from 'react';
import { 
  CheckCircle2, Lock, ChevronRight, LayoutDashboard 
} from 'lucide-react';
import { STEPS_CONFIG } from '../lib/constants';
import { useProject } from '../context/ProjectContext';

export default function Sidebar({ 
    currentStep, 
    onStepChange, 
    isOpen, 
    onToggle, 
    onBackToDashboard,
    maxAllowedStep
}) {
  const { complexInfo, applicationInfo } = useProject();
  
  const verifiedSteps = applicationInfo?.verifiedSteps || [];

  return (
    <aside 
        className={`
            fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800 shadow-xl z-40 
            transition-all duration-300 ease-in-out flex flex-col text-slate-300
            ${isOpen ? 'w-72' : 'w-20'}
        `}
    >
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900">
        <div className={`flex items-center gap-3 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
            <span className="font-bold text-sm">Р</span>
          </div>
          <span className="font-bold text-white tracking-tight text-sm">Реестр МКД</span>
        </div>
        
        <button 
            onClick={onToggle}
            className={`
                p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all ml-auto
                ${!isOpen && 'mx-auto'}
            `}
        >
            <ChevronRight size={18} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}/>
        </button>
      </div>

      {/* Project Info (Compact) */}
      {isOpen && (
          <div className="p-6 pb-2 animate-in fade-in duration-300">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Объект</div>
              <h2 className="text-sm font-bold text-white leading-snug line-clamp-2" title={complexInfo?.name}>
                  {complexInfo?.name || 'Новый проект'}
              </h2>
              <div className="text-xs text-slate-500 mt-1 truncate">{complexInfo?.street || 'Адрес не указан'}</div>
          </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        
        {/* Кнопка "На рабочий стол" */}
        <button 
            onClick={onBackToDashboard}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group mb-6
                text-slate-400 hover:bg-slate-800 hover:text-white
                ${!isOpen && 'justify-center'}
            `}
            title="На рабочий стол"
        >
            <LayoutDashboard size={20} className="group-hover:text-blue-400 transition-colors"/>
            <span className={`text-xs font-bold transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                На рабочий стол
            </span>
        </button>

        {isOpen && <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Этапы работы</div>}

        {STEPS_CONFIG.map((step, idx) => {
            const isActive = currentStep === idx;
            const isLocked = idx > maxAllowedStep;
            const isVerified = verifiedSteps.includes(idx);
            const Icon = step.icon;

            return (
                <button
                    key={step.id}
                    onClick={() => !isLocked && onStepChange(idx)}
                    disabled={isLocked}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group
                        ${!isOpen && 'justify-center'}
                        ${isActive 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' // АКТИВНЫЙ: Синий, яркий
                            : isLocked
                                ? 'text-slate-600 cursor-not-allowed opacity-40' // ЗАБЛОКИРОВАННЫЙ: Темный, прозрачный, без ховера
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white' // ДОСТУПНЫЙ: Серый, белеет при наведении
                        }
                    `}
                    title={step.title}
                >
                    <div className="relative">
                        {/* Иконка */}
                        {isLocked ? (
                            <Lock size={20} className="text-slate-600" /> // Темный замок
                        ) : (
                            <Icon size={20} className={`${isActive ? 'text-white' : (isVerified ? 'text-emerald-500' : 'text-slate-500 group-hover:text-slate-300')} transition-colors`} />
                        )}

                        {/* Индикатор верификации */}
                        {!isLocked && isVerified && !isActive && isOpen && (
                            <div className="absolute -top-1 -right-1 bg-slate-800 rounded-full p-0.5 shadow-sm ring-1 ring-slate-700">
                                <CheckCircle2 size={10} className="text-emerald-500" />
                            </div>
                        )}
                    </div>
                    
                    <div className={`text-left transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                        <div className={`text-xs font-bold leading-none ${isActive ? 'text-white' : (isLocked ? 'text-slate-600' : 'text-slate-300')}`}>
                            {step.title}
                        </div>
                        {/* Подпись "Недоступно" только для заблокированных */}
                        {isLocked && <div className="text-[9px] text-slate-700 mt-1 font-medium tracking-wide">Недоступно</div>}
                    </div>

                    {/* Полоска активного элемента */}
                    {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                    )}
                </button>
            );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
         <div className={`text-[10px] text-slate-600 text-center transition-opacity duration-300 ${!isOpen ? 'opacity-0 hidden' : 'opacity-100'}`}>
             Версия 1.0.3
         </div>
      </div>
    </aside>
  );
}