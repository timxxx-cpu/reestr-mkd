import React, { useState } from 'react';
import { Save, CheckCircle2, LogOut, ArrowRight, Loader2, ArrowLeft, Send } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Button } from './ui/UIKit';
import { useToast } from '../context/ToastContext';
import { ROLES, STEPS_CONFIG, WORKFLOW_STAGES } from '../lib/constants';
import { getStepStage } from '../lib/workflow-utils';

/**
 * Панель управления рабочим процессом (Задачи)
 */
export default function WorkflowBar({ user, currentStep, setCurrentStep, onExit }) {
  const { 
      applicationInfo, 
      saveProjectImmediate, 
      completeTask,
      rollbackTask, 
      isReadOnly 
  } = useProject();
  
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (!applicationInfo) return null;

  const taskIndex = applicationInfo.currentStepIndex || 0;
  const isCurrentTask = currentStep === taskIndex;
  const canGoBack = currentStep > 0;

  // --- ПРОВЕРКА НА ГРАНИЦУ ЭТАПА ---
  const currentStageNum = getStepStage(currentStep);
  const stageConfig = WORKFLOW_STAGES[currentStageNum];
  const isStageBoundary = stageConfig && stageConfig.lastStepIndex === currentStep;
  const isLastStepGlobal = currentStep === STEPS_CONFIG.length - 1;

  // Текст и иконка для кнопки действия
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

  // --- ОБРАБОТЧИКИ ---

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
              // Если отправили на проверку или завершили проект - выходим или показываем уведомление
              toast.success(isLastStepGlobal ? "Проект завершен!" : "Отправлено на проверку");
              
              // Для удобства, если отправили на проверку - переходим на следующий шаг (который будет ReadOnly)
              // или выходим. Обычно удобнее выйти, так как работать дальше нельзя.
              if (isStageBoundary) {
                  onExit(); // Возврат на дашборд
              } else {
                  onExit(); 
              }
          } else {
              toast.success("Задача завершена");
              setCurrentStep(nextIndex); // Идем к следующей задаче
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

  if (user.role !== ROLES.TECHNICIAN || isReadOnly) {
      return null;
  }

  if (!isCurrentTask) {
      return (
          <div className="bg-slate-100 border-b border-slate-200 px-8 py-3 flex justify-between items-center sticky top-0 z-30 animate-in slide-in-from-top-2">
              <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-slate-400"/>
                  Режим просмотра (Задача выполнена)
              </div>
              <Button variant="ghost" onClick={onExit} className="h-8 text-xs bg-white border border-slate-200 shadow-sm">
                  <LogOut size={14} className="mr-2"/> Выйти
              </Button>
          </div>
      );
  }

  return (
    <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm animate-in slide-in-from-top-2">
        <div className="flex items-center gap-4">
            {canGoBack && (
                <Button 
                    variant="ghost" 
                    onClick={handleRollback}
                    disabled={isLoading}
                    className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 px-2 h-9 border border-transparent hover:border-slate-200"
                    title="Вернуться на шаг назад (Сброс прогресса)"
                >
                    <ArrowLeft size={18} />
                </Button>
            )}

            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Текущая задача</span>
                <span className="text-sm font-bold text-slate-800">{STEPS_CONFIG[currentStep]?.title}</span>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <Button 
                variant="secondary" 
                onClick={handleSave} 
                disabled={isLoading}
                className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 h-10 shadow-sm"
            >
                {isLoading ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                Сохранить
            </Button>

            <Button 
                variant="secondary" 
                onClick={handleSaveAndExit} 
                disabled={isLoading}
                className="bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 h-10 shadow-sm"
            >
                <LogOut size={16} className="mr-2"/> Сохранить и выйти
            </Button>

            <div className="h-8 w-px bg-slate-200 mx-1"></div>

            <Button 
                onClick={handleCompleteTask} 
                disabled={isLoading}
                className={`${isStageBoundary ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white shadow-lg h-10 px-6 active:scale-95 transition-transform`}
            >
                {actionBtnText}
                <ActionIcon size={16} className="ml-2 opacity-80"/>
            </Button>
        </div>
    </div>
  );
}