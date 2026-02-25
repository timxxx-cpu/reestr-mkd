import { useCallback } from 'react';
import { ApiService } from '@lib/api-service';

export function useInboxActions({
  user,
  dbScope,
  projects,
  externalSystemOptions,
  setIncomingApps,
  setIsLoadingApps,
  setActiveTab,
  setTaskFilter,
  toast,
}) {
  const handleEmulateIncoming = useCallback(
    buildIncomingEmulatedApplication => {
      setIsLoadingApps(true);
      setTimeout(() => {
        const { app: newApp, sourceLabel } = buildIncomingEmulatedApplication({ externalSystemOptions });
        setIncomingApps(prev => [newApp, ...prev]);
        setIsLoadingApps(false);
        toast.success(`Поступила заявка из ${sourceLabel}`);
      }, 400);
    },
    [externalSystemOptions, setIncomingApps, setIsLoadingApps, toast]
  );

  const handleEmulateResubmission = useCallback(
    buildResubmissionEmulatedApplication => {
      const candidates = (projects || []).filter(p => p?.cadastre?.number || p?.complexInfo?.cadastreNumber);
      if (candidates.length === 0) {
        toast.error('Нет ЖК с кадастровым номером для эмуляции повторной подачи');
        return;
      }

      setIsLoadingApps(true);
      setTimeout(() => {
        const selected = candidates[Math.floor(Math.random() * candidates.length)];
        const cadastreNumber = selected?.cadastre?.number || selected?.complexInfo?.cadastreNumber;
        const source = externalSystemOptions?.[0]?.code || 'EPIGU';

        const newApp = buildResubmissionEmulatedApplication({ candidate: selected, source });

        setIncomingApps(prev => [newApp, ...prev]);
        setIsLoadingApps(false);
        toast.success(`Эмуляция повторной подачи: ${selected?.name || 'ЖК'} (${cadastreNumber})`);
      }, 350);
    },
    [projects, externalSystemOptions, setIncomingApps, setIsLoadingApps, toast]
  );

  const handleTakeToWork = useCallback(async app => {
    const toastId = toast.loading('Создание проекта...');
    try {
      await ApiService.createProjectFromApplication(dbScope, app, user);
      setIncomingApps(prev => prev.filter(a => a.id !== app.id));
      toast.dismiss(toastId);
      toast.success('Проект создан');
      setActiveTab('workdesk');
      setTaskFilter('work');
    } catch (e) {
      console.error(e);
      toast.dismiss(toastId);
      const message = e?.message || 'Не удалось принять заявление';

      if (message.includes('Отказ в принятии')) {
        setIncomingApps(prev =>
          prev.map(item =>
            item.id === app.id
              ? {
                  ...item,
                  status: 'DECLINED',
                  declineReason: message,
                }
              : item
          )
        );
      }

      toast.error('Ошибка: ' + message);
    }
  }, [dbScope, setActiveTab, setIncomingApps, setTaskFilter, toast, user]);

  return {
    handleEmulateIncoming,
    handleEmulateResubmission,
    handleTakeToWork,
  };
}
