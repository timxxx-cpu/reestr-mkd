import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, FileText, CheckSquare, Square, Check, Lock, ArrowRight } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { APP_STATUS, ROLES, WORKFLOW_STAGES, STEPS_CONFIG } from '../lib/constants'; 
import { Button } from './ui/UIKit';
import { useToast } from '../context/ToastContext';

export default function WorkflowBar({ user, currentStep }) {
  const { applicationInfo, updateStatus, setStepVerified } = useProject(); 
  const toast = useToast();
  const navigate = useNavigate();

  if (!applicationInfo) return null;

  const { status, currentStage, verifiedSteps = [] } = applicationInfo;
  
  // --- АВТОМАТИЧЕСКИЙ РАСЧЕТ ГРАНИЦ ТЕКУЩЕГО ЭТАПА ---
  // Это работает для 1, 2, 3 и любых последующих этапов
  const currentStageConfig = WORKFLOW_STAGES[currentStage];
  const prevStageConfig = WORKFLOW_STAGES[currentStage - 1];
  
  // Вычисляем первый и последний шаг текущего этапа
  const startStepIndex = prevStageConfig ? prevStageConfig.lastStepIndex + 1 : 0;
  const endStepIndex = currentStageConfig ? currentStageConfig.lastStepIndex : STEPS_CONFIG.length - 1;

  // Собираем массив индексов всех шагов этого этапа
  const stepsInStage = [];
  for (let i = startStepIndex; i <= endStepIndex; i++) stepsInStage.push(i);
  
  // Проверяем, какие из них еще не завершены
  const unverifiedSteps = stepsInStage.filter(stepIdx => !verifiedSteps.includes(stepIdx));
  const isStageFullyComplete = unverifiedSteps.length === 0;

  // Является ли текущий открытый шаг ПОСЛЕДНИМ в этом этапе?
  const isLastStepOfStage = currentStep === endStepIndex;

  // --- ОПРЕДЕЛЕНИЕ ЭТАПА ТЕКУЩЕГО ШАГА ---
  const getStepStage = (stepIdx) => {
      for (const [stageNum, config] of Object.entries(WORKFLOW_STAGES)) {
          if (stepIdx <= config.lastStepIndex) return parseInt(stageNum);
      }
      return 1;
  };
  const stepStage = getStepStage(currentStep);
  // Показывать кнопки только если мы находимся на шаге, соответствующем текущему активному этапу
  const isStepInCurrentStage = stepStage === currentStage;
  const isStepVerified = verifiedSteps.includes(currentStep);

  // --- ДЕЙСТВИЯ ---

  const handleToggleStepVerify = async () => {
      const newValue = !isStepVerified;
      await setStepVerified(currentStep, newValue);
      if (newValue) toast.success('Шаг отмечен как завершенный');
      else toast.info('Отметка снята');
  };

  const handleSendToReview = async () => {
    if (!isStageFullyComplete) {
        toast.error(`Нельзя отправить на проверку. Завершите все шаги этапа (осталось: ${unverifiedSteps.length})`);
        return;
    }

    if (confirm('Вы уверены, что хотите отправить этап на проверку? Редактирование будет заблокировано.')) {
        await updateStatus(APP_STATUS.REVIEW);
        toast.success('Отправлено на проверку Бригадиру');
        // Возвращаем техника на рабочий стол, чтобы он мог взять следующую задачу
        navigate('/');
    }
  };

  const handleApproveStage = async () => {
    if (!isStageFullyComplete) {
        toast.error(`Нельзя одобрить этап! Не все шаги приняты. Осталось: ${unverifiedSteps.length}`);
        return;
    }

    if (confirm(`Вы подтверждаете завершение Этапа ${currentStage}?`)) {
        const nextStage = currentStage + 1;
        const totalStages = Object.keys(WORKFLOW_STAGES).length;

        if (currentStage >= totalStages) {
            await updateStatus(APP_STATUS.COMPLETED);
            toast.success('Проект полностью завершен!');
        } else {
            await updateStatus(APP_STATUS.NEW, nextStage);
            toast.success(`Этап ${currentStage} принят. Открыт Этап ${nextStage}`);
        }
    }
  };

  const handleRejectStage = async () => {
    const reason = prompt('Укажите причину возврата на доработку:');
    if (reason) {
        await updateStatus(APP_STATUS.REJECTED, currentStage, reason); 
        toast.error('Возвращено технику на доработку');
    }
  };

  // --- ОТРИСОВКА ---

  // 1. ПАНЕЛЬ ТЕХНИКА
  if (user.role === ROLES.TECHNICIAN) {
      // Статусы, когда техник может работать
      if (status === APP_STATUS.NEW || status === APP_STATUS.DRAFT || status === APP_STATUS.REJECTED) {
          return (
            <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <FileText size={16} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase">Текущий статус</div>
                        <div className="text-sm font-bold text-blue-600 flex items-center gap-2">
                            В работе (Этап {currentStage})
                            {status === APP_STATUS.REJECTED && <span className="text-red-500 text-xs bg-red-50 px-2 py-0.5 rounded-full">Было возвращено</span>}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* КНОПКА ЗАВЕРШЕНИЯ ШАГА (Видна на любом шаге текущего этапа) */}
                    {isStepInCurrentStage && (
                        <div className="flex items-center animate-in fade-in">
                            <button 
                                onClick={handleToggleStepVerify}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border shadow-sm transition-all h-9 select-none active:scale-95
                                    ${isStepVerified 
                                        ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-emerald-200' 
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                                    }
                                `}
                            >
                                {isStepVerified ? <Check size={14} strokeWidth={3}/> : <Square size={14}/>}
                                {isStepVerified ? 'Шаг закончен' : 'Закончить шаг'}
                            </button>
                        </div>
                    )}

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    {/* КНОПКА ОТПРАВКИ (Видна ТОЛЬКО на последнем шаге этапа) */}
                    {isLastStepOfStage ? (
                        <Button 
                            onClick={handleSendToReview} 
                            variant="primary" 
                            // Блокируем, если не все шаги этапа завершены
                            disabled={!isStageFullyComplete}
                            className={`animate-in zoom-in ${!isStageFullyComplete ? 'opacity-50 cursor-not-allowed bg-slate-400 shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                            title={!isStageFullyComplete ? `Завершите еще ${unverifiedSteps.length} шагов` : "Отправить на проверку"}
                        >
                            <Clock size={16} className="mr-2"/> Отправить на проверку
                        </Button>
                    ) : (
                        // Подсказка, если это не последний шаг
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 cursor-default">
                            <span>Продолжайте заполнение</span>
                            <ArrowRight size={14}/>
                        </div>
                    )}
                </div>
            </div>
          );
      }
      
      // Если на проверке - режим ожидания
      if (status === APP_STATUS.REVIEW) {
          return (
            <div className="bg-amber-50 border-b border-amber-100 px-8 py-3 flex items-center justify-between sticky top-0 z-30 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center animate-pulse">
                        <Clock size={16} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-amber-600/70 uppercase">Режим ожидания</div>
                        <div className="text-sm font-bold text-amber-700">На проверке у бригадира</div>
                    </div>
                </div>
                <div className="text-xs font-bold text-amber-600 bg-white/50 px-3 py-1.5 rounded-lg">
                    Только чтение
                </div>
            </div>
          );
      }
  }

  // 2. ПАНЕЛЬ БРИГАДИРА / АДМИНА
  if (user.role === ROLES.CONTROLLER || user.role === ROLES.ADMIN) {
      if (status === APP_STATUS.REVIEW) {
          return (
            <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-3 flex items-center justify-between sticky top-0 z-30 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <CheckCircle2 size={16} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-indigo-500 uppercase">Контроль качества</div>
                        <div className="text-sm font-bold text-indigo-700">Проверка этапа {currentStage}</div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* КНОПКА ПРИНЯТИЯ ШАГА БРИГАДИРОМ */}
                    {isStepInCurrentStage ? (
                        <div className="mr-2 flex items-center animate-in fade-in">
                            <button 
                                onClick={handleToggleStepVerify}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border shadow-sm transition-all h-9 select-none active:scale-95
                                    ${isStepVerified 
                                        ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-emerald-200' 
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
                                    }
                                `}
                            >
                                {isStepVerified ? <Check size={14} strokeWidth={3}/> : <Square size={14}/>}
                                {isStepVerified ? 'Шаг принят' : 'Принять шаг'}
                            </button>
                        </div>
                    ) : (
                        <div className="mr-2 text-xs text-slate-400 italic">
                            Шаг другого этапа
                        </div>
                    )}
                    
                    <div className="h-6 w-px bg-indigo-200 mx-1"></div>

                    <Button onClick={handleRejectStage} variant="destructive" className="bg-white border-red-200 text-red-600 hover:bg-red-50 h-9 px-3">
                        <XCircle size={16} className="mr-2"/> Вернуть
                    </Button>
                    
                    <Button 
                        onClick={handleApproveStage} 
                        disabled={!isStageFullyComplete}
                        className={`h-9 px-4 transition-all ${!isStageFullyComplete ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}
                        title={!isStageFullyComplete ? `Осталось проверить шагов: ${unverifiedSteps.length}` : "Одобрить этап"}
                    >
                        {!isStageFullyComplete && <Lock size={14} className="mr-2"/>}
                        {isStageFullyComplete && <CheckCircle2 size={16} className="mr-2"/>}
                        Одобрить этап
                    </Button>
                </div>
            </div>
          );
      }
  }

  return null;
}