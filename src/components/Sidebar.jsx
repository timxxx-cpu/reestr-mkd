import React from 'react';
import { 
  CheckCircle2, Lock, ChevronRight, LayoutDashboard, PieChart 
} from 'lucide-react';
import { STEPS_CONFIG, WORKFLOW_STAGES, APP_STATUS } from '../lib/constants';
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
  
  const getStepStage = (stepIdx) => {
      for (const [stageNum, config] of Object.entries(WORKFLOW_STAGES)) {
          if (stepIdx <= config.lastStepIndex) return parseInt(stageNum);
      }
      return 1;
  };

  const currentStage = applicationInfo?.currentStage || 1;
  const isProjectCompleted = applicationInfo?.status === APP_STATUS.COMPLETED;
  const verifiedStepsList = applicationInfo?.verifiedSteps || [];

  // Подсчет статистики с учетом индивидуальных галочек
  const totalSteps = STEPS_CONFIG.length;
  const completedStepsCount = STEPS_CONFIG.filter((_, idx) => {
      const sStage = getStepStage(idx);
      // Считаем шаг готовым, если проект закрыт ИЛИ этап закрыт ИЛИ шаг отмечен вручную
      return isProjectCompleted || (sStage < currentStage) || verifiedStepsList.includes(idx);
  }).length;

  const progressPercent = Math.round((completedStepsCount / totalSteps) * 100);

  return (
    <aside 
        className={`
            fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800 shadow-xl z-40 
            transition-all duration-300 ease-in-out flex flex-col text-slate-300
            ${isOpen ? 'w-72' : 'w-20'}
        `}
    >
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

      {isOpen && (
          <div className="p-6 pb-2 animate-in fade-in duration-300">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Объект</div>
              <h2 className="text-sm font-bold text-white leading-snug line-clamp-2" title={complexInfo?.name}>
                  {complexInfo?.name || 'Новый проект'}
              </h2>
              <div className="text-xs text-slate-500 mt-1 truncate">{complexInfo?.street || 'Адрес не указан'}</div>
          </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
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
            const stepStage = getStepStage(idx);
            
            // Логика галочки
            const isVerified = isProjectCompleted || (stepStage < currentStage) || verifiedStepsList.includes(idx);
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
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                            : isLocked
                                ? 'text-slate-600 cursor-not-allowed opacity-40'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }
                    `}
                    title={step.title}
                >
                    <div className="relative">
                        {isLocked ? (
                            <Lock size={20} className="text-slate-700" />
                        ) : (
                            <Icon size={20} className={`${isActive ? 'text-white' : (isVerified ? 'text-emerald-500' : 'text-slate-500 group-hover:text-slate-300')} transition-colors`} />
                        )}

                        {!isLocked && isVerified && !isActive && isOpen && (
                            <div className="absolute -top-1 -right-1 bg-slate-900 rounded-full p-0.5 shadow-sm ring-1 ring-slate-700">
                                <CheckCircle2 size={10} className="text-emerald-500" />
                            </div>
                        )}
                    </div>
                    
                    <div className={`text-left transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                        <div className={`text-xs font-bold leading-none ${isActive ? 'text-white' : 'text-slate-300'}`}>
                            {step.title}
                        </div>
                        {isLocked && <div className="text-[9px] text-slate-700 mt-1 font-medium tracking-wide">Недоступно</div>}
                    </div>

                    {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                    )}
                </button>
            );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900">
         <div className={`transition-opacity duration-300 ${!isOpen ? 'opacity-0 hidden' : 'opacity-100'}`}>
             <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                     <PieChart size={14} />
                     <span>Прогресс</span>
                 </div>
                 <div className="text-xs font-bold text-white">
                     {progressPercent}%
                 </div>
             </div>
             <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                 <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                 ></div>
             </div>
             <div className="flex justify-between mt-1">
                <div className="text-[10px] text-slate-600">Одобрено шагов</div>
                <div className="text-[10px] font-bold text-slate-500">{completedStepsCount} / {totalSteps}</div>
             </div>
         </div>
         {!isOpen && <div className="text-[9px] text-center text-slate-700">v1.0</div>}
      </div>
    </aside>
  );
}