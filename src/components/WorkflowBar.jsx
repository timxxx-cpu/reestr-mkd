import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, CheckCircle2, XCircle, FileText, AlertTriangle, 
  MessageSquare, Clock, ShieldCheck 
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { ROLES, APP_STATUS, APP_STATUS_LABELS, WORKFLOW_STAGES, STEPS_CONFIG } from '../lib/constants';
import { Button } from './ui/UIKit';
import { useToast } from '../context/ToastContext';

export default function WorkflowBar({ user, currentStep }) {
    const { applicationInfo, saveData, setStepVerified } = useProject();
    const toast = useToast();
    const navigate = useNavigate();
    
    if (!applicationInfo || !user) return null;

    const currentStatus = applicationInfo.status || APP_STATUS.DRAFT;
    const currentStage = applicationInfo.currentStage || 1;
    const verifiedSteps = applicationInfo.verifiedSteps || [];
    const statusConfig = APP_STATUS_LABELS[currentStatus] || APP_STATUS_LABELS.DRAFT;

    // Определяем список шагов, входящих в текущий этап
    const currentStageRange = useMemo(() => {
        const stageConfig = WORKFLOW_STAGES[currentStage];
        const prevStageConfig = WORKFLOW_STAGES[currentStage - 1];
        // Начало: следующий шаг после предыдущего этапа (или 0)
        const startStep = prevStageConfig ? prevStageConfig.lastStepIndex + 1 : 0;
        // Конец: последний шаг текущего этапа
        const endStep = stageConfig ? stageConfig.lastStepIndex : STEPS_CONFIG.length - 1;
        
        const steps = [];
        for (let i = startStep; i <= endStep; i++) steps.push(i);
        return steps;
    }, [currentStage]);

    // Проверка: Все ли шаги этапа отмечены Бригадиром?
    const isStageFullyVerified = currentStageRange.every(stepIdx => verifiedSteps.includes(stepIdx));
    // Проверен ли конкретно этот шаг
    const isCurrentStepVerified = verifiedSteps.includes(currentStep);

    // --- ДЕЙСТВИЯ ---

    const handleVerifyStep = () => {
        setStepVerified(currentStep, true);
        toast.success("Шаг отмечен как проверенный");
    };

    const handleUnverifyStep = () => {
        setStepVerified(currentStep, false);
    };

    const changeStatus = async (newStatus, newStage = currentStage, comment = '') => {
        const historyEntry = {
            date: new Date().toISOString(),
            status: newStatus,
            user: user.name,
            comment: comment
        };

        const updatedAppInfo = {
            ...applicationInfo,
            status: newStatus,
            currentStage: newStage,
            history: [...(applicationInfo.history || []), historyEntry]
        };

        await saveData({ applicationInfo: updatedAppInfo }, false, true);
        toast.success(`Статус изменен: ${APP_STATUS_LABELS[newStatus].label}`);
    };

    const handleSendToReview = async () => {
        await changeStatus(APP_STATUS.REVIEW);
        navigate('/'); // Возврат на рабочий стол
    };

    const handleApprove = async () => {
        // Блокировка, если не все проверено (дублирует disabled)
        if (!isStageFullyVerified) {
            toast.error("Сначала проверьте все шаги этапа!");
            return;
        }

        if (currentStage < 4) {
            const nextStage = currentStage + 1;
            // Возвращаем в DRAFT (Технику), но повышаем Этап
            await changeStatus(APP_STATUS.DRAFT, nextStage, `Этап ${currentStage} завершен`);
            toast.success(`Переход к Этапу ${nextStage}`);
        } else {
            // Финал
            await changeStatus(APP_STATUS.COMPLETED, currentStage, 'Финальная проверка пройдена');
        }
        navigate('/'); // Возврат на рабочий стол
    };

    const handleReject = async () => {
        const reason = window.prompt("Укажите причину возврата на доработку:");
        if (reason) {
            await changeStatus(APP_STATUS.REJECTED, currentStage, reason);
            navigate('/'); // Возврат на рабочий стол
        }
    };

    // --- УСЛОВИЯ ОТОБРАЖЕНИЯ ---

    const stageConfig = WORKFLOW_STAGES[currentStage];
    // Техник может отправить только с ПОСЛЕДНЕГО шага этапа
    const isAtSubmitStep = currentStep === stageConfig?.lastStepIndex;

    const canSubmit = (user.role === ROLES.TECHNICIAN || user.role === ROLES.ADMIN) && 
                      (currentStatus === APP_STATUS.DRAFT || currentStatus === APP_STATUS.REJECTED) &&
                      isAtSubmitStep;

    const canReview = (user.role === ROLES.CONTROLLER || user.role === ROLES.ADMIN) && 
                      currentStatus === APP_STATUS.REVIEW;

    return (
        <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between shadow-sm relative z-30">
            
            {/* Статус и Этап */}
            <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${statusConfig.color}`}>
                    {statusConfig.label}
                </div>
                <div className="hidden md:flex flex-col text-[10px] leading-tight">
                    <span className="text-slate-400 font-bold uppercase">Этап {currentStage}</span>
                    <span className="text-slate-700 font-bold text-xs">
                        Проверено: {currentStageRange.filter(s => verifiedSteps.includes(s)).length} / {currentStageRange.length}
                    </span>
                </div>
                {/* Комментарий возврата */}
                {currentStatus === APP_STATUS.REJECTED && (
                    <div className="hidden lg:flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-100 max-w-xs truncate">
                        <MessageSquare size={14}/>
                        <span className="truncate italic">
                            {applicationInfo.history?.[applicationInfo.history.length-1]?.comment || "..."}
                        </span>
                    </div>
                )}
            </div>

            {/* Кнопки действий */}
            <div className="flex items-center gap-3">
                {canSubmit && (
                    <Button onClick={handleSendToReview} className="bg-blue-600 hover:bg-blue-700 shadow-blue-200 animate-in fade-in zoom-in">
                        Отправить проверку (Этап {currentStage}) <Send size={16} className="ml-2"/>
                    </Button>
                )}

                {canReview && (
                    <>
                        {/* 1. Кнопка проверки конкретного шага */}
                        <div className="mr-2 flex items-center">
                            {isCurrentStepVerified ? (
                                <button 
                                    onClick={handleUnverifyStep}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-all"
                                    title="Нажмите, чтобы снять отметку"
                                >
                                    <ShieldCheck size={16}/> Шаг проверен
                                </button>
                            ) : (
                                <Button onClick={handleVerifyStep} variant="secondary" className="border-slate-300 text-slate-600 hover:text-blue-600 hover:border-blue-300">
                                    Отметить как проверенный
                                </Button>
                            )}
                        </div>

                        <div className="h-6 w-px bg-slate-200 mx-2"></div>

                        {/* 2. Кнопка возврата */}
                        <Button variant="destructive" onClick={handleReject} className="bg-red-50 text-red-600 hover:bg-red-100 border-red-100">
                            <XCircle size={16}/> 
                        </Button>
                        
                        {/* 3. Кнопка принятия этапа (Активна только если все шаги проверены) */}
                        <Button 
                            onClick={handleApprove} 
                            disabled={!isStageFullyVerified}
                            className={`shadow-emerald-200 transition-all ${isStageFullyVerified ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed opacity-70'}`}
                            title={!isStageFullyVerified ? "Проверьте все шаги этапа, чтобы активировать" : ""}
                        >
                            <CheckCircle2 size={16} className="mr-2"/> 
                            {currentStage < 4 ? `Принять Этап ${currentStage}` : 'Закрыть заявку'}
                        </Button>
                    </>
                )}

                {!canSubmit && !canReview && user.role === ROLES.TECHNICIAN && currentStatus === APP_STATUS.DRAFT && (
                    <span className="text-xs text-slate-400 hidden sm:inline">
                       Заполните все шаги этапа
                    </span>
                )}
                
                {currentStatus === APP_STATUS.REVIEW && user.role === ROLES.TECHNICIAN && (
                    <span className="text-xs font-bold text-orange-600 flex items-center gap-1">
                        <Clock size={14}/> На проверке
                    </span>
                )}
            </div>
        </div>
    );
}