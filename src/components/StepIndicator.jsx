import React from 'react';
import { Check, Circle, AlertCircle } from 'lucide-react';
import { STEPS_CONFIG } from '../lib/constants';

export default function StepIndicator({ currentStep = 0 }) {
  // --- ЗАЩИТА ОТ ОШИБОК ---
  // Если конфиг еще не прогрузился, просто ничего не рисуем (чтобы не было белого экрана)
  if (!STEPS_CONFIG || !Array.isArray(STEPS_CONFIG)) return null;

  // Безопасный индекс
  const safeIndex = Math.min(Math.max(0, currentStep), STEPS_CONFIG.length - 1);
  const currentConfig = STEPS_CONFIG[safeIndex];

  if (!currentConfig) return null;

  // Иконка заголовка
  const TitleIcon = currentConfig.icon || AlertCircle;

  // Прогресс в процентах
  const totalSteps = Math.max(STEPS_CONFIG.length - 1, 1);
  const progressPercent = (safeIndex / totalSteps) * 100;

  return (
      <div className="w-full mb-8 select-none animate-in fade-in duration-500">
        
        {/* ВЕРХНЯЯ ЧАСТЬ: ИНФОРМАЦИЯ О ТЕКУЩЕМ ШАГЕ */}
        <div className="flex justify-between items-end mb-4 px-1">
            <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Шаг {safeIndex + 1} из {STEPS_CONFIG.length}
                </span>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                        <TitleIcon size={20} />
                    </div>
                    {currentConfig.title}
                </h2>
            </div>
            
            {/* Процент завершения (справа) */}
            <div className="text-right hidden sm:block">
                <span className="text-xs font-bold text-slate-500">
                    Прогресс: <span className="text-blue-600">{Math.round(progressPercent)}%</span>
                </span>
            </div>
        </div>

        {/* НИЖНЯЯ ЧАСТЬ: ВИЗУАЛЬНЫЙ ТРЕК */}
        <div className="relative h-10 flex items-center w-full">
            
            {/* Серый фон линии */}
            <div className="absolute left-0 right-0 h-1 bg-slate-100 rounded-full -z-10" />
            
            {/* Синяя линия прогресса */}
            <div 
                className="absolute left-0 h-1 bg-blue-600 rounded-full -z-10 transition-all duration-500 ease-out" 
                style={{ width: `${progressPercent}%` }}
            />

            {/* Точки шагов */}
            <div className="flex justify-between w-full relative px-0.5">
                {STEPS_CONFIG.map((step, idx) => {
                    const isCompleted = idx < safeIndex;
                    const isActive = idx === safeIndex;
                    const isFuture = idx > safeIndex;
                    
                    const StepIcon = step.icon || Circle;

                    return (
                        <div 
                            key={step.id || idx} 
                            className={`flex flex-col items-center justify-center transition-all duration-500 relative group ${isActive ? 'scale-110' : 'scale-100'}`}
                        >
                            {/* Кружок */}
                            <div 
                                className={`
                                    flex items-center justify-center transition-all duration-300 shadow-sm border-2 rounded-full
                                    ${isActive 
                                        ? 'w-8 h-8 bg-white border-blue-600 text-blue-600 shadow-blue-200 shadow-md z-20' 
                                        : isCompleted
                                            ? 'w-5 h-5 bg-blue-600 border-blue-600 text-white z-10'
                                            : 'w-3 h-3 bg-white border-slate-300 z-0'
                                    }
                                `}
                            >
                                {isActive && <StepIcon size={14} />}
                                {isCompleted && <Check size={10} strokeWidth={4} />}
                            </div>

                            {/* Всплывающая подсказка (Tooltip) */}
                            {/* Показываем название шага при наведении на точку */}
                            <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <div className="bg-slate-800 text-white text-[10px] py-1 px-2 rounded font-medium whitespace-nowrap shadow-xl">
                                    {step.title}
                                </div>
                                {/* Треугольничек тултипа */}
                                <div className="w-2 h-2 bg-slate-800 rotate-45 absolute -top-1 left-1/2 -translate-x-1/2"></div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
      </div>
  );
}