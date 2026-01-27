import React from 'react';
import { Check, Circle, AlertCircle, ShieldCheck } from 'lucide-react';
import { STEPS_CONFIG } from '../lib/constants';
import { useProject } from '../context/ProjectContext';

export default function StepIndicator({ currentStep = 0 }) {
  const { applicationInfo } = useProject();
  
  const verifiedSteps = applicationInfo?.verifiedSteps || [];

  if (!STEPS_CONFIG || !Array.isArray(STEPS_CONFIG)) return null;

  const safeIndex = Math.min(Math.max(0, currentStep), STEPS_CONFIG.length - 1);
  const currentConfig = STEPS_CONFIG[safeIndex];

  if (!currentConfig) return null;

  const TitleIcon = currentConfig.icon || AlertCircle;
  const totalSteps = Math.max(STEPS_CONFIG.length - 1, 1);
  const progressPercent = (safeIndex / totalSteps) * 100;

  return (
      <div className="w-full mb-8 select-none animate-in fade-in duration-500">
        
        <div className="flex justify-between items-end mb-4 px-1">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Шаг {safeIndex + 1} из {STEPS_CONFIG.length}
                    </span>
                    {verifiedSteps.includes(currentStep) && (
                        <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-bold uppercase">
                            <ShieldCheck size={10}/> Проверен
                        </span>
                    )}
                </div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${verifiedSteps.includes(currentStep) ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        <TitleIcon size={20} />
                    </div>
                    {currentConfig.title}
                </h2>
            </div>
            
            <div className="text-right hidden sm:block">
                <span className="text-xs font-bold text-slate-500">
                    Прогресс: <span className="text-blue-600">{Math.round(progressPercent)}%</span>
                </span>
            </div>
        </div>

        <div className="relative h-10 flex items-center w-full">
            <div className="absolute left-0 right-0 h-1 bg-slate-100 rounded-full -z-10" />
            <div 
                className="absolute left-0 h-1 bg-blue-600 rounded-full -z-10 transition-all duration-500 ease-out" 
                style={{ width: `${progressPercent}%` }}
            />

            <div className="flex justify-between w-full relative px-0.5">
                {STEPS_CONFIG.map((step, idx) => {
                    const isCompleted = idx < safeIndex;
                    const isActive = idx === safeIndex;
                    const isVerified = verifiedSteps.includes(idx);
                    
                    const StepIcon = step.icon || Circle;

                    let circleClass = 'bg-white border-slate-300';
                    if (isVerified) circleClass = 'bg-emerald-500 border-emerald-500 text-white';
                    else if (isActive) circleClass = 'bg-white border-blue-600 text-blue-600 shadow-blue-200 shadow-md';
                    else if (isCompleted) circleClass = 'bg-blue-600 border-blue-600 text-white';

                    return (
                        <div 
                            key={step.id || idx} 
                            className={`flex flex-col items-center justify-center transition-all duration-500 relative group ${isActive ? 'scale-110' : 'scale-100'}`}
                        >
                            <div 
                                className={`
                                    flex items-center justify-center transition-all duration-300 shadow-sm border-2 rounded-full z-10
                                    ${isActive ? 'w-8 h-8 z-20' : 'w-5 h-5'}
                                    ${circleClass}
                                `}
                            >
                                {isVerified ? <Check size={12} strokeWidth={4}/> : (isActive ? <StepIcon size={14} /> : (isCompleted && <Check size={10} strokeWidth={4} />))}
                            </div>

                            <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                <div className="bg-slate-800 text-white text-[10px] py-1 px-2 rounded font-medium whitespace-nowrap shadow-xl flex items-center gap-1">
                                    {step.title}
                                    {isVerified && <ShieldCheck size={10} className="text-emerald-400"/>}
                                </div>
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