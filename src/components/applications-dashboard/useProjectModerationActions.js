import { useCallback } from 'react';
import { ApiService } from '@lib/api-service';
import { getDeclineSubstatusByRole } from './action-rules';
import { getRoleId, getRoleKey } from '@lib/roles';

export function useProjectModerationActions({
  user,
  dbScope,
  projects,
  dashboardProjects,
  setActionModal,
  toast,
  refetch,
}) {
  const resolveProjectById = useCallback(
    projectId =>
      (dashboardProjects || []).find(p => p.id === projectId) ||
      (projects || []).find(p => p.id === projectId) ||
      null,
    [dashboardProjects, projects]
  );

  const handleModalConfirm = useCallback(async actionModal => {
    if (!actionModal) return;
    const { type, payload, result } = actionModal;

    try {
      if (type === 'REASSIGN') {
        const newAssigneeName = result;
        if (!newAssigneeName) {
          toast.error('Исполнитель не выбран');
          return;
        }
        await ApiService.assignTechnician({
          applicationId: payload.projectAppId,
          assigneeUserId: newAssigneeName, // <-- ИЗМЕНЕНО ЗДЕСЬ
        });
        toast.success(`Исполнитель изменен: ${newAssigneeName}`);
      } else if (type === 'DELETE') {
        await ApiService.deleteProject(dbScope, payload.projectId);
        toast.success('Проект удален');
      } else if (type === 'DECLINE') {
        await ApiService.declineApplication({
          applicationId: payload.projectAppId,
          nextSubstatus: getDeclineSubstatusByRole(getRoleKey(user?.roleId ?? user?.role)),
          prevStatus: payload.currentStatus,
          userName: user.name,
          userRoleId: getRoleId(user?.roleId ?? user?.role),
          userRole: getRoleKey(user?.roleId ?? user?.role),
          reason: result,
        });
        toast.success('Заявление отклонено');
      } else if (type === 'RETURN') {
        await ApiService.returnFromDecline({
          applicationId: payload.projectAppId,
          userName: user.name,
          comment: result,
        });
        toast.success('Заявление возвращено технику на доработку');
      }
      refetch();
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при выполнении операции');
    }
  }, [dbScope, refetch, toast, user]);

  const handleReassignProject = useCallback((projectId, projectName, currentAssignee) => {
    const project = resolveProjectById(projectId);
    if (!project?.applicationId) {
      toast.error('Заявка не найдена');
      return;
    }

    setActionModal({
      type: 'REASSIGN',
      config: {
        type: 'select',
        intent: 'info',
        title: 'Передача заявки',
        subtitle: `ЖК "${projectName}"`,
        description: `Текущий исполнитель: ${currentAssignee || 'не назначен'}. Выберите нового ответственного:`,
        label: 'Новый исполнитель',
        confirmText: 'Назначить',
      },
      payload: { projectId, projectAppId: project.applicationId },
    });
  }, [resolveProjectById, setActionModal, toast]);

  const handleDeleteProject = useCallback(projectId => {
    setActionModal({
      type: 'DELETE',
      config: {
        type: 'confirm',
        intent: 'destructive',
        title: 'Удаление проекта',
        description: 'Вы уверены, что хотите удалить проект и все связанные данные? Это действие необратимо.',
        confirmText: 'Да, удалить',
      },
      payload: { projectId },
    });
  }, [setActionModal]);

  const handleDeclineProject = useCallback((projectId, projectName) => {
    const project = resolveProjectById(projectId);
    if (!project?.applicationId) return;

    setActionModal({
      type: 'DECLINE',
      config: {
        type: 'input',
        intent: 'destructive',
        title: 'Отклонить заявление',
        subtitle: projectName,
        label: 'Причина отказа',
        placeholder: 'Опишите причину отказа подробно...',
        confirmText: 'Отклонить',
        required: true,
        minLength: 10,
      },
      payload: {
        projectId,
        projectAppId: project.applicationId,
        projectName,
        currentStatus: project.applicationInfo?.status,
      },
    });
  }, [resolveProjectById, setActionModal]);

  const handleReturnFromDecline = useCallback((projectId, projectName) => {
    const project = resolveProjectById(projectId);
    if (!project?.applicationId) return;

    setActionModal({
      type: 'RETURN',
      config: {
        type: 'input',
        intent: 'warning',
        title: 'Вернуть на доработку',
        subtitle: projectName,
        label: 'Комментарий (необязательно)',
        placeholder: 'Укажите инструкции для техника...',
        confirmText: 'Вернуть',
        required: false,
      },
      payload: { projectId, projectAppId: project.applicationId },
    });
  }, [resolveProjectById, setActionModal]);

  return {
    handleModalConfirm,
    handleReassignProject,
    handleDeleteProject,
    handleDeclineProject,
    handleReturnFromDecline,
  };
}
