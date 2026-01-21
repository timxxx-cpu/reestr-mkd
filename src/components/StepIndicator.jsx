import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { STEPS_CONFIG } from '../lib/constants';

export default function StepIndicator({ currentStep }) {
  return (
      <div className="flex items-center justify-between w-full mb-8 px-2 select-none overflow-x-auto pb-2">
        {STEPS_CONFIG.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isActive = idx === currentStep;

            return (
                <React.Fragment key={step.id}>
                    {/* Кружок шага */}
                    <div className={`flex flex-col items-center relative group cursor-default transition-all duration-300 min-w-[60px] ${isActive ? 'flex-1' : ''}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-300 z-10 
                            ${isActive 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-110' 
                                : isCompleted 
                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                    : 'bg-white border-slate-200 text-slate-300'
                            }`}
                        >
                            {isCompleted ? <CheckCircle2 size={14} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                        </div>
                        
                        {/* Подпись снизу */}
                        <div className={`mt-2 flex flex-col items-center transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-60 hover:opacity-100'}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                                {step.title}
                            </span>
                        </div>
                    </div>

                    {/* Соединительная линия */}
                    {idx < STEPS_CONFIG.length - 1 && (
                        <div className={`flex-1 h-[2px] mx-2 mb-6 rounded-full transition-all duration-500 min-w-[20px] ${isCompleted ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                    )}
                </React.Fragment>
            )
        })}
      </div>
  );
}