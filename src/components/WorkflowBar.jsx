import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, FileText, CheckSquare, Square, Check, Lock, ArrowRight, Flag, AlertTriangle } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { APP_STATUS, ROLES, WORKFLOW_STAGES, STEPS_CONFIG } from '../lib/constants'; 
import { Button } from './ui/UIKit';
import { useToast } from '../context/ToastContext';

export default function WorkflowBar({ user, currentStep }) {
  const { applicationInfo, updateStatus, setStepVerified, setStepCompleted } = useProject(); 
  const toast = useToast();
  const navigate = useNavigate();

  if (!applicationInfo) return null;

  const { status, currentStage, verifiedSteps = [], completedSteps = [], rejectionReason } = applicationInfo;
  
  // --- РАСЧЕТ ГРАНИЦ ЭТАПА ---
  const currentStageConfig = WORKFLOW_STAGES[currentStage];
  const prevStageConfig = WORKFLOW_STAGES[currentStage - 1];
  
  const startStepIndex = prevStageConfig ? prevStageConfig.lastStepIndex + 1 : 0;
  const endStepIndex = currentStageConfig ? currentStageConfig.lastStepIndex : STEPS_CONFIG.length - 1;

  const stepsInStage = [];
  for (let i = startStepIndex; i <= endStepIndex; i++) stepsInStage.push(i);
  
  const isLastStepOfStage = currentStep === endStepIndex;
  
  const totalStages = Object.keys(WORKFLOW_STAGES).length;
  const isFinalStage = currentStage === totalStages;

  const getStepStage = (stepIdx) => {
      for (const [stageNum, config] of Object.entries(WORKFLOW_STAGES)) {
          if (stepIdx <= config.lastStepIndex) return parseInt(stageNum);
      }
      return 1;
  };
  const stepStage = getStepStage(currentStep);
  const isStepInCurrentStage = stepStage === currentStage;

  // --- ЛОГИКА ТЕХНИКА (completedSteps) ---
  const isCompletedByTech = completedSteps.includes(currentStep);
  const uncompletedSteps = stepsInStage.filter(s => !completedSteps.includes(s));
  const isStageFullyCompletedByTech = uncompletedSteps.length === 0;

  // --- ЛОГИКА БРИГАДИРА (verifiedSteps) ---
  const isVerifiedByController = verifiedSteps.includes(currentStep);
  const unverifiedSteps = stepsInStage.filter(s => !verifiedSteps.includes(s));
  const canApproveStage = unverifiedSteps.length === 0;

  // --- ДЕЙСТВИЯ ---

  const handleTechToggle = async () => {
      await setStepCompleted(currentStep, !isCompletedByTech);
      if (!isCompletedByTech) toast.success('Шаг отмечен как завершенный');
  };

  const handleControllerToggle = async () => {
      await setStepVerified(currentStep, !isVerifiedByController);
      if (!isVerifiedByController) toast.success('Шаг принят');
  };

  const handleSendToReview = async () => {
    if (!isStageFullyCompletedByTech) {
        toast.error(`Завершите все шаги этапа (осталось: ${uncompletedSteps.length})`);
        return;
    }
    if (confirm('Отправить на проверку? Проект станет доступен только для чтения.')) {
        await updateStatus(APP_STATUS.REVIEW);
        toast.success('Отправлено');
        navigate('/'); 
    }
  };

  const handleApproveStage = async () => {
    if (!canApproveStage) {
        toast.error(`Осталось проверить шагов: ${unverifiedSteps.length}`);
        return;
    }
    const msg = isFinalStage ? "Утвердить проект окончательно?" : `Одобрить Этап ${currentStage}?`;
    
    if (confirm(msg)) {
        const nextStage = currentStage + 1;
        
        if (isFinalStage) {
            await updateStatus(APP_STATUS.COMPLETED);
            toast.success('Проект завершен!');
        } else {
            const nextStatus = nextStage === totalStages ? APP_STATUS.REVIEW : APP_STATUS.NEW;
            await updateStatus(nextStatus, nextStage);
            toast.success(`Этап ${currentStage} принят.`);
        }
        navigate('/'); 
    }
  };

  const handleRejectStage = async () => {
    const reason = prompt('Укажите причину возврата (обязательно):');
    if (reason && reason.trim()) {
        // Передаем причину в updateStatus
        await updateStatus(APP_STATUS.REJECTED, currentStage, reason); 
        toast.error('Возвращено на доработку');
        navigate('/');
    } else if (reason !== null) {
        toast.error('Необходимо указать причину!');
    }
  };

  // --- ОТРИСОВКА ---

  // 1. ТЕХНИК
  if (user.role === ROLES.TECHNICIAN) {
      if (status === APP_STATUS.NEW || status === APP_STATUS.DRAFT || status === APP_STATUS.REJECTED) {
          return (
            <div className="flex flex-col sticky top-0 z-30 shadow-sm animate-in slide-in-from-top-2">
                {/* Блок с причиной возврата (если есть) */}
                {status === APP_STATUS.REJECTED && rejectionReason && (
                    <div className="bg-red-50 px-8 py-2 border-b border-red-100 flex items-center gap-2 text-red-700 text-sm font-bold">
                        <AlertTriangle size={16} />
                        <span>Причина возврата: {rejectionReason}</span>
                    </div>
                )}

                <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><FileText size={16} /></div>
                        <div><div className="text-xs font-bold text-slate-500 uppercase">Текущий статус</div><div className="text-sm font-bold text-blue-600">В работе (Этап {currentStage})</div></div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isStepInCurrentStage && (
                            <div className="flex items-center animate-in fade-in">
                                <button onClick={handleTechToggle} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border shadow-sm transition-all h-9 ${isCompletedByTech ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                                    {isCompletedByTech ? <Check size={14} strokeWidth={3}/> : <Square size={14}/>} {isCompletedByTech ? 'Шаг закончен' : 'Закончить шаг'}
                                </button>
                            </div>
                        )}
                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                        {isLastStepOfStage ? (
                            <Button onClick={handleSendToReview} variant="primary" disabled={!isStageFullyCompletedByTech} className={`animate-in zoom-in ${!isStageFullyCompletedByTech ? 'opacity-50 cursor-not-allowed bg-slate-400 shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
                                <Clock size={16} className="mr-2"/> Отправить на проверку
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 cursor-default"><span>Далее</span><ArrowRight size={14}/></div>
                        )}
                    </div>
                </div>
            </div>
          );
      }
      if (status === APP_STATUS.REVIEW) {
          return <div className="bg-amber-50 border-b border-amber-100 px-8 py-3 flex items-center justify-between sticky top-0 z-30"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center animate-pulse"><Clock size={16} /></div><div><div className="text-xs font-bold text-amber-600/70 uppercase">Режим ожидания</div><div className="text-sm font-bold text-amber-700">На проверке у бригадира</div></div></div><div className="text-xs font-bold text-amber-600 bg-white/50 px-3 py-1.5 rounded-lg">Только чтение</div></div>;
      }
  }

  // 2. БРИГАДИР / АДМИН
  if (user.role === ROLES.CONTROLLER || user.role === ROLES.ADMIN) {
      if (status === APP_STATUS.REVIEW) {
          return (
            <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-3 flex items-center justify-between sticky top-0 z-30 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        {isFinalStage ? <Flag size={16}/> : <CheckCircle2 size={16} />}
                    </div>
                    <div>
                        <div className="text-xs font-bold text-indigo-500 uppercase">{isFinalStage ? "Финальная проверка" : "Контроль качества"}</div>
                        <div className="text-sm font-bold text-indigo-700">{isFinalStage ? "Утверждение проекта" : `Проверка этапа ${currentStage}`}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isStepInCurrentStage ? (
                        <div className="mr-2 flex items-center animate-in fade-in">
                            <button onClick={handleControllerToggle} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border shadow-sm transition-all h-9 ${isVerifiedByController ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                                {isVerifiedByController ? <Check size={14} strokeWidth={3}/> : <Square size={14}/>} {isVerifiedByController ? 'Шаг принят' : 'Принять шаг'}
                            </button>
                        </div>
                    ) : <div className="mr-2 text-xs text-slate-400 italic">Шаг другого этапа</div>}
                    
                    <div className="h-6 w-px bg-indigo-200 mx-1"></div>
                    
                    <Button 
                        onClick={handleRejectStage} 
                        variant="destructive" 
                        disabled={!isStepInCurrentStage} 
                        className={`bg-white border-red-200 text-red-600 hover:bg-red-50 h-9 px-3 ${!isStepInCurrentStage ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <XCircle size={16} className="mr-2"/> Вернуть
                    </Button>

                    <Button onClick={handleApproveStage} disabled={!canApproveStage} className={`h-9 px-4 transition-all ${!canApproveStage ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : (isFinalStage ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200')} text-white`}>
                        {!canApproveStage && <Lock size={14} className="mr-2"/>}
                        {canApproveStage && <CheckCircle2 size={16} className="mr-2"/>} 
                        {isFinalStage ? "Утвердить проект" : "Одобрить этап"}
                    </Button>
                </div>
            </div>
          );
      }
  }
  return null;
}