import React, { useState } from 'react';
import { 
  Save, CheckCircle2, LogOut, ArrowRight, Loader2, 
  ArrowLeft, Send, History, ThumbsUp, XCircle, ShieldCheck // [FIX] Добавлен ShieldCheck
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Button } from './ui/UIKit';
import { useToast } from '../context/ToastContext';
import { ROLES, STEPS_CONFIG, WORKFLOW_STAGES, APP_STATUS } from '../lib/constants';
import { getStepStage } from '../lib/workflow-utils';

/**
 * Панель управления рабочим процессом (Задачи)
 */
export default function WorkflowBar({ user, currentStep, setCurrentStep, onExit, onOpenHistory }) {
  const { 
      applicationInfo, 
      saveProjectImmediate, 
      completeTask,
      rollbackTask, 
      reviewStage, 
      isReadOnly 
  } = useProject();
  
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (!applicationInfo) return null;

  const taskIndex = applicationInfo.currentStepIndex || 0;
  const isCurrentTask = currentStep === taskIndex;
  const canGoBack = currentStep > 0;
  
  // Статус заявки
  const appStatus = applicationInfo.status;
  const isReviewMode = appStatus === APP_STATUS.REVIEW;
  
  // Роли
  const isController = user.role === ROLES.CONTROLLER || user.role === ROLES.ADMIN;
  const isTechnician = user.role === ROLES.TECHNICIAN;

  const currentStageNum = getStepStage(currentStep);
  const stageConfig = WORKFLOW_STAGES[currentStageNum];
  const isStageBoundary = stageConfig && stageConfig.lastStepIndex === currentStep;
  const isLastStepGlobal = currentStep === STEPS_CONFIG.length - 1;

  // --- ЛОГИКА ТЕХНИКА ---
  let actionBtnText = "Завершить";
  let ActionIcon = ArrowRight;
  let confirmMsg = "Завершить задачу и перейти к следующей?";

  if (isLastStepGlobal) {
      actionBtnText = "Завершить проект";
      ActionIcon = CheckCircle2;
      confirmMsg = "Это последний шаг. Завершить проект?";
  } else if (isStageBoundary) {
      actionBtnText = "Отправить на проверку";
      ActionIcon = Send;
      confirmMsg = `Вы завершаете Этап ${currentStageNum}. Отправить данные на проверку Бригадиру?`;
  }

  // --- ОБРАБОТЧИКИ ТЕХНИКА ---
  const handleSave = async () => {
      setIsLoading(true);
      try {
          await saveProjectImmediate();
          toast.success("Изменения сохранены");
      } catch (e) {
          console.error(e);
          toast.error("Ошибка сохранения");
      } finally {
          setIsLoading(false);
      }
  };

  const handleSaveAndExit = async () => {
      setIsLoading(true);
      try {
          await saveProjectImmediate();
          onExit(); 
      } catch (e) {
          console.error(e);
          toast.error("Ошибка сохранения");
          setIsLoading(false);
      }
  };

  const handleCompleteTask = async () => {
      if (!confirm(confirmMsg)) return;

      setIsLoading(true);
      try {
          const nextIndex = await completeTask(currentStep);
          
          if (isStageBoundary || isLastStepGlobal) {
              toast.success(isLastStepGlobal ? "Проект завершен!" : "Отправлено на проверку");
              onExit(); 
          } else {
              toast.success("Задача завершена");
              setCurrentStep(nextIndex); 
          }
      } catch (e) {
          console.error(e);
          toast.error("Ошибка завершения задачи");
      } finally {
          setIsLoading(false);
      }
  };

  const handleRollback = async () => {
      if (!confirm("Вернуться на шаг назад? Выполненные задачи начиная с текущего шага нужно будет пройти заново.")) return;

      setIsLoading(true);
      try {
          const prevIndex = await rollbackTask();
          toast.info("Возврат к предыдущей задаче");
          setCurrentStep(prevIndex);
      } catch (e) {
          console.error(e);
          toast.error("Ошибка возврата");
      } finally {
          setIsLoading(false);
      }
  };

  // --- ОБРАБОТЧИКИ БРИГАДИРА ---
  const handleApproveStage = async () => {
      if (!confirm(`Одобрить результаты Этапа? Заявка вернется Технику для продолжения работы.`)) return;
      
      setIsLoading(true);
      try {
          // eslint-disable-next-line no-unused-vars
          const nextIndex = await reviewStage('APPROVE');
          toast.success("Этап принят. Заявка передана Технику.");
          onExit(); 
      } catch (e) {
          console.error(e);
          toast.error("Ошибка при одобрении");
      } finally {
          setIsLoading(false);
      }
  };

  const handleRejectStage = async () => {
      const reason = prompt("Укажите причину возврата (обязательно):");
      if (!reason || !reason.trim()) return;

      setIsLoading(true);
      try {
          // eslint-disable-next-line no-unused-vars
          const prevIndex = await reviewStage('REJECT', reason);
          toast.error("Возвращено на доработку");
          onExit(); 
      } catch (e) {
          console.error(e);
          toast.error("Ошибка при возврате");
      } finally {
          setIsLoading(false);
      }
  };


  // === ОТРИСОВКА ===

  // 1. Сценарий БРИГАДИРА (Заявка на проверке)
  if (isReviewMode && isController) {
      return (
          <div className="bg-indigo-900 border-b border-indigo-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl animate-in slide-in-from-top-2 text-white">
              <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                         <ShieldCheck size={12}/> Контроль качества
                      </span>
                      <span className="text-base font-bold text-white tracking-tight">Проверка этапа</span>
                  </div>
              </div>

              <div className="flex items-center gap-3">
                  <Button 
                      variant="ghost" 
                      onClick={onOpenHistory}
                      className="text-indigo-300 hover:text-white hover:bg-white/10 px-2 h-9"
                      title="История действий"
                  >
                      <History size={18} />
                  </Button>
                  
                  <div className="h-8 w-px bg-indigo-700 mx-1"></div>

                  <Button 
                      onClick={handleRejectStage} 
                      disabled={isLoading}
                      className="bg-white text-red-600 hover:bg-red-50 border border-transparent shadow-sm h-10 px-4"
                  >
                      <XCircle size={16} className="mr-2"/> Вернуть
                  </Button>

                  <Button 
                      onClick={handleApproveStage} 
                      disabled={isLoading}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/20 h-10 px-6 border-0"
                  >
                      <ThumbsUp size={16} className="mr-2"/> Принять этап
                  </Button>
              </div>
          </div>
      );
  }

  // 2. Сценарий ТЕХНИКА (Только если он на своей задаче)
  if ((isTechnician || user.role === ROLES.ADMIN) && !isReviewMode && isCurrentTask && !isReadOnly) {
      return (
        <div className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl shadow-slate-900/10 animate-in slide-in-from-top-2 text-white">
            <div className="flex items-center gap-4">
                {canGoBack && (
                    <Button 
                        variant="ghost" 
                        onClick={handleRollback}
                        disabled={isLoading}
                        className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9 border border-transparent"
                        title="Вернуться на шаг назад (Сброс прогресса)"
                    >
                        <ArrowLeft size={18} />
                    </Button>
                )}

                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Текущая задача</span>
                    <span className="text-base font-bold text-white tracking-tight">{STEPS_CONFIG[currentStep]?.title}</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button 
                    variant="ghost" 
                    onClick={onOpenHistory}
                    disabled={isLoading}
                    className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9"
                    title="История действий"
                >
                    <History size={18} />
                </Button>

                <div className="h-8 w-px bg-slate-700 mx-1"></div>

                <Button 
                    variant="secondary" 
                    onClick={handleSave} 
                    disabled={isLoading}
                    className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white h-10 shadow-sm"
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                    Сохранить
                </Button>

                <Button 
                    variant="secondary" 
                    onClick={handleSaveAndExit} 
                    disabled={isLoading}
                    className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white h-10 shadow-sm"
                >
                    <LogOut size={16} className="mr-2"/> Выйти
                </Button>

                <div className="h-8 w-px bg-slate-700 mx-1"></div>

                <Button 
                    onClick={handleCompleteTask} 
                    disabled={isLoading}
                    className={`${isStageBoundary ? 'bg-indigo-500 hover:bg-indigo-400 shadow-indigo-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'} text-white shadow-lg h-10 px-6 active:scale-95 transition-transform border-0`}
                >
                    {actionBtnText}
                    <ActionIcon size={16} className="ml-2 opacity-80"/>
                </Button>
            </div>
        </div>
      );
  }

  // 3. Режим просмотра (для всех остальных случаев)
  if (!isCurrentTask && !isReviewMode) {
       return (
          <div className="bg-slate-100 border-b border-slate-200 px-8 py-3 flex justify-between items-center sticky top-0 z-30 animate-in slide-in-from-top-2">
              <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-slate-400"/>
                  Режим просмотра (Задача выполнена)
              </div>
              <div className="flex gap-2">
                  <Button variant="ghost" onClick={onOpenHistory} className="h-8 text-xs bg-white border border-slate-200 shadow-sm text-slate-500">
                      <History size={14} className="mr-2"/> История
                  </Button>
                  <Button variant="ghost" onClick={onExit} className="h-8 text-xs bg-white border border-slate-200 shadow-sm text-slate-700">
                      <LogOut size={14} className="mr-2"/> Выйти
                  </Button>
              </div>
          </div>
      );
  }

  return null;
}