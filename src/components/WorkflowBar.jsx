import React, { useState } from 'react';
import { 
  Save, CheckCircle2, LogOut, ArrowRight, Loader2, 
  ArrowLeft, Send, History, ThumbsUp, XCircle, ShieldCheck,
  AlertTriangle, X
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Button } from './ui/UIKit';
import { useToast } from '../context/ToastContext';
import { ROLES, STEPS_CONFIG, WORKFLOW_STAGES, APP_STATUS } from '../lib/constants';
import { getStepStage } from '../lib/workflow-utils';

// Импорт валидатора
import { validateStepCompletion } from '../lib/step-validators';

// --- МОДАЛКА ОШИБОК ВАЛИДАЦИИ (НОВАЯ) ---
const ValidationErrorsModal = ({ errors, onClose }) => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-full text-red-500 shadow-sm border border-red-100">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-900">Обнаружены ошибки</h3>
                        <p className="text-xs text-red-600 font-medium">Необходимо исправить {errors.length} проблем(ы) перед продолжением</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 text-red-400 hover:text-red-700 transition-colors">
                    <X size={20}/>
                </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
                <div className="space-y-3">
                    {errors.map((err, idx) => (
                        <div key={idx} className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-red-50/30 hover:border-red-100 transition-colors">
                            <div className="mt-0.5 min-w-[20px] text-center font-bold text-xs text-slate-400">{idx + 1}.</div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-slate-800 leading-tight mb-1">{err.title}</div>
                                <div className="text-xs text-slate-500 leading-relaxed">{err.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end">
                <Button onClick={onClose} className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg px-6">
                    Понятно, исправлю
                </Button>
            </div>
        </div>
    </div>
);

// --- МОДАЛКА ВЫХОДА ---
const ExitConfirmationModal = ({ onCancel, onConfirm }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-red-50/50">
                    <AlertTriangle size={28} />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">Несохраненные изменения</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    У вас есть данные, которые не были сохранены.<br/>
                    Если выйти сейчас, <span className="font-bold text-red-600">все изменения будут потеряны</span>.
                </p>
                <div className="flex flex-col gap-2">
                    <Button onClick={onConfirm} className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 border-0 h-10">Да, выйти без сохранения</Button>
                    <Button variant="ghost" onClick={onCancel} className="w-full text-slate-500 hover:text-slate-800 h-10">Отмена</Button>
                </div>
            </div>
        </div>
    </div>
);

// --- МОДАЛКА ЗАВЕРШЕНИЯ ЗАДАЧИ ---
const CompleteTaskModal = ({ onCancel, onConfirm, message }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/50">
                    <CheckCircle2 size={28} />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">Завершение задачи</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed px-2">
                    {message}<br/>
                    <span className="opacity-70 mt-2 block font-medium">Данные будут сохранены автоматически.</span>
                </p>
                <div className="flex flex-col gap-2">
                    <Button onClick={onConfirm} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 border-0 h-10">Да, завершить</Button>
                    <Button variant="ghost" onClick={onCancel} className="w-full text-slate-500 hover:text-slate-800 h-10">Отмена</Button>
                </div>
            </div>
        </div>
    </div>
);

export default function WorkflowBar({ user, currentStep, setCurrentStep, onExit, onOpenHistory }) {
  const projectContext = useProject();
  const { 
      applicationInfo, 
      saveProjectImmediate, 
      completeTask,
      rollbackTask, 
      reviewStage, 
      isReadOnly,
      hasUnsavedChanges
  } = projectContext;
  
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Состояния модалок
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  
  // [NEW] Состояние для списка ошибок
  const [validationErrors, setValidationErrors] = useState([]);

  if (!applicationInfo) return null;

  const taskIndex = applicationInfo.currentStepIndex || 0;
  const isCurrentTask = currentStep === taskIndex;
  const canGoBack = currentStep > 0;
  
  const appStatus = applicationInfo.status;
  const isReviewMode = appStatus === APP_STATUS.REVIEW;
  
  const isController = user.role === ROLES.CONTROLLER || user.role === ROLES.ADMIN;
  const isTechnician = user.role === ROLES.TECHNICIAN;

  const currentStageNum = getStepStage(currentStep);
  // eslint-disable-next-line no-unused-vars
  const stageConfig = WORKFLOW_STAGES[currentStageNum];
  const isStageBoundary = stageConfig && stageConfig.lastStepIndex === currentStep;
  const isLastStepGlobal = currentStep === STEPS_CONFIG.length - 1;

  const INTEGRATION_START_IDX = 12;
  const isIntegrationStage = currentStep >= INTEGRATION_START_IDX;

  let actionBtnText = "Перейти к следующей задаче";
  let ActionIcon = ArrowRight;
  let confirmMsg = "Завершить текущую задачу и перейти к следующему шагу?";

  if (isLastStepGlobal) {
      actionBtnText = "Завершить проект";
      ActionIcon = CheckCircle2;
      confirmMsg = "Это последний шаг. Вы уверены, что хотите полностью завершить проект?";
  } else if (isStageBoundary) {
      actionBtnText = "Отправить на проверку";
      ActionIcon = Send;
      confirmMsg = `Вы завершаете Этап ${currentStageNum}. Отправить все данные на проверку Бригадиру?`;
  }

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
          onExit(true); 
      } catch (e) {
          console.error(e);
          toast.error("Ошибка сохранения");
          setIsLoading(false);
      }
  };

  const handleExitWithoutSave = () => {
      if (hasUnsavedChanges) {
          setShowExitConfirm(true);
      } else {
          onExit(true);
      }
  };

  const confirmExitWithoutSave = () => {
      setShowExitConfirm(false);
      onExit(true);
  };

  // --- COMPLETE TASK HANDLERS ---
  const handleCompleteTaskClick = () => {
      const currentStepId = STEPS_CONFIG[currentStep]?.id;
      
      // Запрашиваем полный список ошибок
      const errors = validateStepCompletion(currentStepId, projectContext);
      
      if (errors && errors.length > 0) {
          // Если ошибки есть — показываем модалку
          setValidationErrors(errors);
          // (Можно дополнительно пикнуть тостом, но модалка лучше)
          return;
      }

      // Если ошибок нет — переходим к подтверждению
      setShowCompleteConfirm(true);
  };

  const performCompletion = async () => {
      setShowCompleteConfirm(false);
      setIsLoading(true);
      try {
          const nextIndex = await completeTask(currentStep);
          
          if (isStageBoundary || isLastStepGlobal) {
              toast.success(isLastStepGlobal ? "Проект завершен!" : "Отправлено на проверку");
              onExit(true);
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

  const handleApproveStage = async () => {
      if (!confirm(`Одобрить результаты Этапа? Заявка вернется Технику для продолжения работы.`)) return;
      setIsLoading(true);
      try {
          const nextIndex = await reviewStage('APPROVE');
          toast.success("Этап принят. Заявка передана Технику.");
          onExit(true);
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
          const prevIndex = await reviewStage('REJECT', reason);
          toast.error("Возвращено на доработку");
          onExit(true);
      } catch (e) {
          console.error(e);
          toast.error("Ошибка при возврате");
      } finally {
          setIsLoading(false);
      }
  };

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
                  <Button variant="ghost" onClick={onOpenHistory} className="text-indigo-300 hover:text-white hover:bg-white/10 px-2 h-9" title="История действий">
                      <History size={18} />
                  </Button>
                  <div className="h-8 w-px bg-indigo-700 mx-1"></div>
                  <Button onClick={handleRejectStage} disabled={isLoading} className="bg-white text-red-600 hover:bg-red-50 border border-transparent shadow-sm h-10 px-4">
                      <XCircle size={16} className="mr-2"/> Вернуть
                  </Button>
                  <Button onClick={handleApproveStage} disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/20 h-10 px-6 border-0">
                      <ThumbsUp size={16} className="mr-2"/> Принять этап
                  </Button>
              </div>
          </div>
      );
  }

  if ((isTechnician || user.role === ROLES.ADMIN) && !isReviewMode && isCurrentTask && !isReadOnly) {
      const isActionDisabled = isLoading || !isTechnician;

      return (
        <>
            {/* МОДАЛКИ */}
            {validationErrors.length > 0 && (
                <ValidationErrorsModal 
                    errors={validationErrors} 
                    onClose={() => setValidationErrors([])} 
                />
            )}

            {showExitConfirm && (
                <ExitConfirmationModal 
                    onCancel={() => setShowExitConfirm(false)} 
                    onConfirm={confirmExitWithoutSave} 
                />
            )}
            
            {showCompleteConfirm && (
                <CompleteTaskModal 
                    message={confirmMsg}
                    onCancel={() => setShowCompleteConfirm(false)}
                    onConfirm={performCompletion}
                />
            )}

            <div className="bg-slate-900 border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xl shadow-slate-900/10 animate-in slide-in-from-top-2 text-white">
                <div className="flex items-center gap-4">
                    {canGoBack && !isIntegrationStage && (
                        <Button variant="ghost" onClick={handleRollback} disabled={isActionDisabled} className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9 border border-transparent" title="Вернуться на шаг назад">
                            <ArrowLeft size={18} />
                        </Button>
                    )}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Текущая задача</span>
                        <span className="text-base font-bold text-white tracking-tight">{STEPS_CONFIG[currentStep]?.title}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={onOpenHistory} disabled={isLoading} className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9" title="История действий">
                        <History size={18} />
                    </Button>

                    <div className="h-8 w-px bg-slate-700 mx-1"></div>

                    <Button variant="ghost" onClick={handleExitWithoutSave} disabled={isActionDisabled} className={`text-red-400 hover:text-red-300 hover:bg-red-900/20 px-3 h-10 border border-transparent transition-colors text-xs font-bold ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Выйти без сохранения
                    </Button>

                    <Button onClick={handleSave} disabled={isActionDisabled} className={`h-10 shadow-sm transition-all border ${hasUnsavedChanges ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 ring-2 ring-blue-500/30 animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'}`}>
                        {isLoading ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                        {hasUnsavedChanges ? "Сохранить *" : "Сохранить"}
                    </Button>

                    <Button variant="secondary" onClick={handleSaveAndExit} disabled={isActionDisabled} className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white h-10 shadow-sm">
                        <LogOut size={16} className="mr-2"/> Сохранить и Выйти
                    </Button>

                    <div className="h-8 w-px bg-slate-700 mx-1"></div>

                    <Button onClick={handleCompleteTaskClick} disabled={isActionDisabled} className={`${isStageBoundary ? 'bg-indigo-500 hover:bg-indigo-400 shadow-indigo-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'} text-white shadow-lg h-10 px-6 active:scale-95 transition-transform border-0`}>
                        {actionBtnText}
                        <ActionIcon size={16} className="ml-2 opacity-80"/>
                    </Button>
                </div>
            </div>
        </>
      );
  }

  if (!isCurrentTask && !isReviewMode) {
       return (
          <div className="bg-slate-900 border-b border-slate-800 px-8 py-3 flex justify-between items-center sticky top-0 z-30 animate-in slide-in-from-top-2 text-slate-300">
              <div className="flex items-center gap-4">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-500">
                      <CheckCircle2 size={16} />
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Статус</span>
                      <span className="text-sm font-bold text-slate-300">Задача выполнена (Режим просмотра)</span>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <Button variant="ghost" onClick={onOpenHistory} className="h-9 px-3 text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white">
                      <History size={14} className="mr-2"/> История
                  </Button>
                  <Button variant="ghost" onClick={() => onExit(false)} className="h-9 px-3 text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white">
                      <LogOut size={14} className="mr-2"/> Выйти
                  </Button>
              </div>
          </div>
      );
  }

  return null;
}