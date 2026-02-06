import React, { useState, useEffect } from 'react';
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

// --- МОДАЛКА ВОЗВРАТА НА ПРЕДЫДУЩУЮ ЗАДАЧУ ---
const RollbackConfirmationModal = ({ currentStepTitle, prevStepTitle, onCancel, onConfirm, isLoading }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white text-amber-600 border border-amber-200 flex items-center justify-center">
                    <ArrowLeft size={18} />
                </div>
                <div>
                    <h3 className="text-base font-black text-slate-800">Возврат к предыдущей задаче</h3>
                    <p className="text-[11px] text-slate-600">Проверьте параметры перед подтверждением</p>
                </div>
            </div>
            <div className="p-6 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <div><span className="font-bold text-slate-500">Текущая задача:</span> {currentStepTitle}</div>
                    <div className="mt-1"><span className="font-bold text-slate-500">После возврата:</span> {prevStepTitle}</div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Система выполнит возврат на предыдущий шаг. Перед возвратом будут сохранены текущие изменения.</p>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">Статус задачи будет обновлен в соответствии с Workflow и записан в историю действий.</p>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onCancel} className="flex-1 h-10" disabled={isLoading}>Отмена</Button>
                    <Button onClick={onConfirm} className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white" disabled={isLoading}>
                        {isLoading ? <Loader2 size={14} className="animate-spin mr-2"/> : <ArrowLeft size={14} className="mr-2"/>}
                        Подтвердить возврат
                    </Button>
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

const SaveProgressModal = ({ status, message, onOk }) => {
    const isSaving = status === 'saving';
    const isError = status === 'error';

    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
                <div className="p-6 text-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ${isError ? 'bg-red-50 text-red-500 ring-red-50/60' : 'bg-blue-50 text-blue-600 ring-blue-50/60'}`}>
                        {isSaving ? <Loader2 size={26} className="animate-spin"/> : (isError ? <XCircle size={26} /> : <CheckCircle2 size={26} />)}
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">
                        {isSaving ? 'Идет запись данных' : (isError ? 'Запись не произведена' : 'Запись выполнена')}
                    </h3>
                    <p className="text-xs text-slate-500 mb-6 leading-relaxed">{message}</p>
                    {/* Кнопка ОК показывается только при ошибке или если нужен ручной выход (для обратной совместимости) */}
                    {!isSaving && (
                        <Button
                            onClick={onOk}
                            className="w-full bg-slate-900 text-white hover:bg-slate-800 h-10"
                        >
                            ОК
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function WorkflowBar({ user, currentStep, setCurrentStep, onExit, onOpenHistory }) {
  const projectContext = useProject();
  const { 
      applicationInfo, 
      saveProjectImmediate, 
      completeTask,
      rollbackTask, 
      reviewStage, 
      isReadOnly,
      hasUnsavedChanges,
      getValidationSnapshot,
      refetch
  } = projectContext;
  
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Состояния модалок
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [saveNotice, setSaveNotice] = useState({ open: false, status: 'saving', message: '', onOk: null });
  
  const [validationErrors, setValidationErrors] = useState([]);
  const [isTaskSwitchBlocking, setIsTaskSwitchBlocking] = useState(false);
  const [pendingStepTarget, setPendingStepTarget] = useState(null);

  useEffect(() => {
      if (!isTaskSwitchBlocking) return;
      if (pendingStepTarget === null) return;
      if (currentStep !== pendingStepTarget) return;

      // Даем React дорендерить следующий экран шага, затем снимаем блокировку кликов.
      requestAnimationFrame(() => {
          requestAnimationFrame(() => {
              setIsTaskSwitchBlocking(false);
              setPendingStepTarget(null);
          });
      });
  }, [isTaskSwitchBlocking, pendingStepTarget, currentStep]);

  if (!applicationInfo) return null;

  const taskIndex = applicationInfo.currentStepIndex || 0;
  const isCurrentTask = currentStep === taskIndex;
  const canGoBack = currentStep > 0;
  
  const appStatus = applicationInfo.status;
  const isReviewMode = appStatus === APP_STATUS.REVIEW;
  
  const isController = user.role === ROLES.CONTROLLER || user.role === ROLES.ADMIN;
  const isTechnician = user.role === ROLES.TECHNICIAN;

  const currentStageNum = getStepStage(currentStep);
   
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
      setSaveNotice({ open: true, status: 'saving', message: 'Пожалуйста, дождитесь окончания записи...', onOk: null });
      try {
          await saveProjectImmediate();
          setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
          toast.success("Данные успешно сохранены");
      } catch (e) {
          console.error(e);
          setSaveNotice({ open: true, status: 'error', message: 'Ошибка: запись не произведена.', onOk: () => setSaveNotice({ ...saveNotice, open: false }) });
      } finally {
          setIsLoading(false);
      }
  };

  const handleSaveAndExit = async () => {
      setIsLoading(true);
      setSaveNotice({ open: true, status: 'saving', message: 'Сохранение перед выходом...', onOk: null });
      try {
          await saveProjectImmediate();
          setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
          onExit(true);
      } catch (e) {
          console.error(e);
          setSaveNotice({ open: true, status: 'error', message: 'Ошибка: запись не произведена.', onOk: () => setSaveNotice({ ...saveNotice, open: false }) });
      } finally {
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

  // --- COMPLETE TASK HANDLERS (AUTOMATIC) ---
  const handleCompleteTaskClick = async () => {
      setIsLoading(true);
      setSaveNotice({ open: true, status: 'saving', message: 'Сохранение и проверка данных перед завершением...', onOk: null });

      try {
          // Сначала сохраняем локальные pending-изменения в БД без промежуточного refetch.
          await saveProjectImmediate({ shouldRefetch: false });

          // Затем принудительно берем свежий снимок из БД и валидируем именно его,
          // чтобы не требовался ручной refresh страницы.
          const refetchResult = await refetch();
          const dbSnapshot = refetchResult?.data;

          const currentStepId = STEPS_CONFIG[currentStep]?.id;
          const fallbackSnapshot = typeof getValidationSnapshot === 'function' ? getValidationSnapshot() : projectContext;
          const validationData = dbSnapshot || fallbackSnapshot;
          const errors = validateStepCompletion(currentStepId, validationData);

          setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });

          if (errors && errors.length > 0) {
              setValidationErrors(errors);
              return;
          }

          setShowCompleteConfirm(true);
      } catch (e) {
          console.error(e);
          setSaveNotice({ open: true, status: 'error', message: 'Ошибка: запись или проверка не выполнена.', onOk: () => setSaveNotice({ open: false, status: 'saving', message: '', onOk: null }) });
      } finally {
          setIsLoading(false);
      }
  };

  const performCompletion = async () => {
      setShowCompleteConfirm(false);
      setIsLoading(true);
      setSaveNotice({ open: true, status: 'saving', message: 'Запись данных и завершение задачи...', onOk: null });
      
      try {
          const nextIndex = await completeTask(currentStep);
          setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });

          if (isStageBoundary || isLastStepGlobal) {
              toast.success('Этап завершен. Отправлено на проверку.');
              onExit(true); // Авто-выход на рабочий стол
          } else {
              setIsTaskSwitchBlocking(true);
              setPendingStepTarget(nextIndex);
              toast.success('Задача выполнена.');
              setCurrentStep(nextIndex); // Авто-переход на след шаг
          }
      } catch (e) {
          console.error(e);
          setIsTaskSwitchBlocking(false);
          setPendingStepTarget(null);
          setSaveNotice({ open: true, status: 'error', message: 'Ошибка: запись не произведена.', onOk: () => setSaveNotice({ ...saveNotice, open: false }) });
      } finally {
          setIsLoading(false);
      }
  };

  const handleSaveNoticeOk = () => {
      if (saveNotice.status === 'saving') return;
      const callback = saveNotice.onOk;
      setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
      if (typeof callback === 'function') callback();
  };

  const handleRollback = () => {
      setShowRollbackConfirm(true);
  };

  const performRollback = async () => {
      setShowRollbackConfirm(false);
      setIsLoading(true);
      setSaveNotice({ open: true, status: 'saving', message: 'Возврат к предыдущей задаче...', onOk: null });
      try {
          const prevIndex = await rollbackTask();
          setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
          toast.info("Возврат к предыдущей задаче");
          setCurrentStep(prevIndex);
      } catch (e) {
          console.error(e);
          setSaveNotice({ open: true, status: 'error', message: 'Ошибка возврата', onOk: () => setSaveNotice({ open: false, status: 'saving', message: '', onOk: null }) });
      } finally {
          setIsLoading(false);
      }
  };

  // --- REVIEW HANDLERS (CONTROLLER) ---
  const handleApproveStage = async () => {
      if (!confirm(`Одобрить результаты Этапа?`)) return;
      setIsLoading(true);
      setSaveNotice({ open: true, status: 'saving', message: 'Сохранение решения...', onOk: null });
      
      try {
          await reviewStage('APPROVE');
          setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
          toast.success("Этап принят. Переход к следующему этапу.");
          onExit(true); // Авто-выход
      } catch (e) {
          console.error(e);
          setSaveNotice({ open: true, status: 'error', message: 'Ошибка при одобрении', onOk: () => setSaveNotice({ ...saveNotice, open: false }) });
      } finally {
          setIsLoading(false);
      }
  };

  const handleRejectStage = async () => {
      const reason = prompt("Укажите причину возврата (обязательно):");
      if (!reason || !reason.trim()) return;
      
      setIsLoading(true);
      setSaveNotice({ open: true, status: 'saving', message: 'Возврат на доработку...', onOk: null });
      
      try {
          await reviewStage('REJECT', reason);
          setSaveNotice({ open: false, status: 'saving', message: '', onOk: null });
          toast.error("Возвращено на доработку");
          onExit(true); // Авто-выход
      } catch (e) {
          console.error(e);
          setSaveNotice({ open: true, status: 'error', message: 'Ошибка при возврате', onOk: () => setSaveNotice({ ...saveNotice, open: false }) });
      } finally {
          setIsLoading(false);
      }
  };

  if (isReviewMode && isController) {
      return (
          <>
          {saveNotice.open && <SaveProgressModal status={saveNotice.status} message={saveNotice.message} onOk={handleSaveNoticeOk} />}
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
          </>
      );
  }

  if ((isTechnician || user.role === ROLES.ADMIN) && !isReviewMode && isCurrentTask && !isReadOnly) {
      const isActionDisabled = isLoading || !isTechnician || saveNotice.open;

      return (
        <>
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

            {showRollbackConfirm && (
                <RollbackConfirmationModal
                    currentStepTitle={STEPS_CONFIG[currentStep]?.title || 'Текущий шаг'}
                    prevStepTitle={STEPS_CONFIG[Math.max(0, currentStep - 1)]?.title || 'Предыдущий шаг'}
                    onCancel={() => setShowRollbackConfirm(false)}
                    onConfirm={performRollback}
                    isLoading={isLoading}
                />
            )}

            {saveNotice.open && (
                <SaveProgressModal 
                    status={saveNotice.status}
                    message={saveNotice.message}
                    onOk={handleSaveNoticeOk}
                />
            )}

            {isTaskSwitchBlocking && (
                <div className="fixed inset-0 z-[140] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 px-6 py-5 flex items-center gap-3">
                        <Loader2 size={18} className="animate-spin text-blue-600" />
                        <div>
                            <div className="text-sm font-bold text-slate-800">Переход к следующей задаче</div>
                            <div className="text-xs text-slate-500">Пожалуйста, подождите. Экран временно заблокирован.</div>
                        </div>
                    </div>
                </div>
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
                    <Button variant="ghost" onClick={onOpenHistory} disabled={isActionDisabled} className="text-slate-400 hover:text-white hover:bg-white/10 px-2 h-9" title="История действий">
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
