import React, { useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { STEPS_CONFIG, WORKFLOW_STAGES, APP_STATUS, ROLES } from '../lib/constants';
import { useProject } from '../context/ProjectContext';

export default function StepIndicator({ currentStep }) {
  const { applicationInfo, userProfile } = useProject();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.children[currentStep];
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentStep]);

  const getStepStage = (stepIdx) => {
      for (const [stageNum, config] of Object.entries(WORKFLOW_STAGES)) {
          if (stepIdx <= config.lastStepIndex) return parseInt(stageNum);
      }
      return 1;
  };

  const currentStage = applicationInfo?.currentStage || 1;
  const isProjectCompleted = applicationInfo?.status === APP_STATUS.COMPLETED;
  
  // Техник видит свои completed, Бригадир свои verified
  const completedList = userProfile?.role === ROLES.TECHNICIAN 
      ? (applicationInfo?.completedSteps || []) 
      : (applicationInfo?.verifiedSteps || []);

  return (
    <div className="mb-6">
      <div ref={scrollRef} className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
        {STEPS_CONFIG.map((step, idx) => {
          const isActive = idx === currentStep;
          const stepStage = getStepStage(idx);
          
          const isVerified = isProjectCompleted || (stepStage < currentStage) || completedList.includes(idx);
          const Icon = step.icon;

          return (
            <div 
              key={step.id} 
              title={step.title}
              className={`
                flex-shrink-0 flex items-center justify-center rounded-lg border transition-all duration-300 cursor-default
                ${isActive 
                    ? 'bg-slate-900 text-white border-slate-900 px-4 py-2 gap-2 shadow-lg shadow-slate-200' 
                    : isVerified
                        ? 'w-9 h-9 bg-emerald-100 text-emerald-600 border-emerald-200' 
                        : 'w-9 h-9 bg-white text-slate-300 border-slate-200'
                }
              `}
            >
              {isVerified && !isActive ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
              {isActive && <span className="text-xs font-bold whitespace-nowrap animate-in fade-in">{step.title}</span>}
            </div>
          );
        })}
      </div>
      <div className="h-0.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
         <div className="h-full bg-slate-900 transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / STEPS_CONFIG.length) * 100}%` }}></div>
      </div>
    </div>
  );
}