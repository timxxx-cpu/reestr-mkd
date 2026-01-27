import React from 'react';
import { CheckCircle2, AlertCircle, Clock, ArrowRight, XCircle, FileText, CheckSquare, Square, Check } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { APP_STATUS, ROLES, WORKFLOW_STAGES } from '../lib/constants'; 
import { Button } from './ui/UIKit';
import { useToast } from '../context/ToastContext';
import { RegistryService } from '../lib/registry-service'; // Импортируем сервис

export default function WorkflowBar({ user, currentStep }) {
  // Достаем dbScope (customScope) из контекста, если он там есть, или хардкодим константу
  const { applicationInfo, updateStatus, project, setProject, customScope } = useProject(); 
  const toast = useToast();

  // Если customScope не прокинут в хук, используем значение по умолчанию
  const DB_SCOPE = customScope || 'shared_dev_env';

  if (!applicationInfo) return null;

  const { status, currentStage } = applicationInfo;
  // Гарантируем, что массив существует
  const verifiedSteps = applicationInfo.verifiedSteps || [];
  
  const getStepStage = (stepIdx) => {
      for (const [stageNum, config] of Object.entries(WORKFLOW_STAGES)) {
          if (stepIdx <= config.lastStepIndex) return parseInt(stageNum);
      }
      return 1;
  };
  
  const stepStage = getStepStage(currentStep);
  const isStepInCurrentStage = stepStage === currentStage;
  const isStepVerified = verifiedSteps.includes(currentStep);

  // --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ---
  const handleToggleStepVerify = async () => {
      let newVerifiedSteps;
      
      // 1. Вычисляем новый массив
      if (isStepVerified) {
          newVerifiedSteps = verifiedSteps.filter(s => s !== currentStep);
      } else {
          newVerifiedSteps = [...verifiedSteps, currentStep];
      }

      // 2. Создаем ПОЛНУЮ копию объекта проекта с обновленными данными
      const updatedProject = {
          ...project,
          applicationInfo: {
              ...project.applicationInfo,
              verifiedSteps: newVerifiedSteps
          }
      };

      try {
          // 3. Обновляем UI мгновенно
          setProject(updatedProject); 

          // 4. Сохраняем в базу ЯВНО передавая обновленный объект
          // Это решает проблему "ничего не происходит", так как мы не зависим от асинхронности React state
          await RegistryService.updateProject(DB_SCOPE, project.id, updatedProject);
          
          // Уведомление
          if (!isStepVerified) {
              toast.success('Шаг принят');
          } else {
              toast.info('Отметка снята');
          }
      } catch (error) {
          console.error(error);
          toast.error("Ошибка сохранения");
      }
  };

  const handleSendToReview = async () => {
    if (confirm('Вы уверены, что хотите отправить этап на проверку? Редактирование будет заблокировано.')) {
        await updateStatus(APP_STATUS.REVIEW);
        toast.success('Отправлено на проверку Бригадиру');
    }
  };

  const handleApproveStage = async () => {
    // Проверяем, все ли шаги текущего этапа приняты
    // (логика упрощена для демо)
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
                
                <Button onClick={handleSendToReview} variant="primary" className="bg-blue-600 hover:bg-blue-700 shadow-blue-200">
                    <Clock size={16} className="mr-2"/> Отправить на проверку
                </Button>
            </div>
          );
      }
      
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
                    {/* КНОПКА ПРОВЕРКИ ТЕКУЩЕГО ШАГА */}
                    {isStepInCurrentStage && (
                        <div className="mr-2 flex items-center animate-in fade-in">
                            <button 
                                onClick={handleToggleStepVerify}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border shadow-sm transition-all h-9 select-none active:scale-95
                                    ${isStepVerified 
                                        ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-emerald-200' // Активна
                                        : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600' // Не активна
                                    }
                                `}
                            >
                                {isStepVerified ? <Check size={14} strokeWidth={3}/> : <Square size={14}/>}
                                {isStepVerified ? 'Шаг принят' : 'Принять шаг'}
                            </button>
                        </div>
                    )}
                    
                    <div className="h-6 w-px bg-indigo-200 mx-1"></div>

                    <Button onClick={handleRejectStage} variant="destructive" className="bg-white border-red-200 text-red-600 hover:bg-red-50 h-9 px-3">
                        <XCircle size={16} className="mr-2"/> Вернуть
                    </Button>
                    <Button onClick={handleApproveStage} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 h-9 px-4">
                        <CheckCircle2 size={16} className="mr-2"/> Одобрить этап
                    </Button>
                </div>
            </div>
          );
      }
  }

  return null;
}