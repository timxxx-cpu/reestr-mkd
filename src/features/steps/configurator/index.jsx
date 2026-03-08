import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProject } from '@context/ProjectContext';
import { useBuildingType } from '@hooks/useBuildingType';

import ConfigHeader from './ConfigHeader';

import {
  BLOCK_FILL_STATUS,
  validateStepCompletion,
  getStepBlocksForStatus,
  buildScopedContextForBlock,
} from '@lib/step-validators';
// 1. Импортируем конфигурацию шагов
import { STEPS_CONFIG } from '@lib/constants'; 
import { Modal, Button, BlockingLoader } from '@components/ui/UIKit';
import { AlertTriangle } from 'lucide-react';

const StandardView = React.lazy(() => import('./views/StandardView'));
const ParkingView = React.lazy(() => import('./views/ParkingView'));
const InfrastructureView = React.lazy(() => import('./views/InfrastructureView'));

const ConfiguratorViewFallback = () => (
  <div className="flex min-h-[400px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
    <span className="text-sm font-semibold text-slate-400">Загрузка раздела...</span>
  </div>
);

const getStepId = (mode) => {
  if (mode === 'nonres') return 'registry_nonres';
  if (mode === 'res') return 'registry_res';
  if (mode === 'floors') return 'floors';
  return null;
};

export default function BuildingConfiguratorIndex({ buildingId, mode = 'all', onBack }) {
  const {
    composition,
    buildingDetails,
    floorData,
    entrancesData,
    flatMatrix,
    mopData,
    saveStepBuildingStatuses,
    saveProjectImmediate,
    isReadOnly,
    setHasUnsavedChanges,
    applicationInfo, // 2. Достаем информацию о текущем шаге заявки
  } = useProject();
  
  const queryClient = useQueryClient();
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const building = useMemo(
    () => composition.find(c => c.id === buildingId),
    [composition, buildingId]
  );

  const typeInfo = useBuildingType(building);

  if (!building) return <div className="p-8 text-center">Объект не найден</div>;

  const { isParking, isInfrastructure } = typeInfo;

  const collectValidationErrors = (stepId, building) => {
    const contextData = {
      composition,
      buildingDetails,
      floorData,
      entrancesData,
      flatMatrix,
      mopData,
    };
    const blocks = getStepBlocksForStatus(stepId, building, buildingDetails);
    let allErrors = [];

    blocks.forEach(block => {
      const scopedContext = buildScopedContextForBlock(stepId, building, block, contextData);
      const errors = validateStepCompletion(stepId, scopedContext) || [];
      if (errors.length > 0) {
        allErrors = [...allErrors, ...errors];
      }
    });

    return allErrors;
  };

  // Wait for any background queries/mutations (like DebouncedInput) to finish
  const waitForPendingMutations = async () => {
    const startedAt = Date.now();
    const timeoutMs = 8000;
    while (queryClient.isMutating() > 0) {
      if (Date.now() - startedAt > timeoutMs) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const handleSave = async () => {
    const stepId = getStepId(mode);
    
    if (!building || !stepId) return;
    if (isReadOnly) return;

    try {
      setIsSavingStatus(true);
      setValidationWarnings([]);

      // 1. Force blur to commit any active input changes
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      
      // 2. Short wait for state updates to propagate
      await new Promise(resolve => setTimeout(resolve, 350));

      // 3. Save current project data WITHOUT refetching (avoids race conditions)
      await saveProjectImmediate({ shouldRefetch: false });

      // 4. Ensure all background requests are done
      await waitForPendingMutations();

      // 5. Now save the status (this function internally refetches data)
      const result = await saveStepBuildingStatuses({
        stepId,
        buildingId: building.id,
      });

      // 6. [CRITICAL] Force reset the "Unsaved Changes" flag.
      // Even if refetch triggered a re-render or minor state shift, we consider this "Saved".
      setHasUnsavedChanges(false);

      // 7. Check validation status
      if (result && result.buildingStatus === BLOCK_FILL_STATUS.PARTIAL) {
        const errors = collectValidationErrors(stepId, building);
        if (errors.length > 0) {
          setValidationWarnings(errors);
          setShowWarningModal(true);
        }
      }
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setIsSavingStatus(false);
    }
  };

 const stepId = getStepId(mode);

  // 3. Логика проверки совпадения шагов
  // Получаем ID текущего активного шага из Workflow
  const currentWorkflowStepIndex = applicationInfo?.currentStepIndex ?? 0;
  const currentWorkflowStepId = STEPS_CONFIG[currentWorkflowStepIndex]?.id;

  // Кнопка активна, только если:
  // 1. Проект не ReadOnly
  // 2. Мы находимся в режиме, который подразумевает сохранение (stepId существует)
  // 3. ID шага в редакторе СОВПАДАЕТ с текущим активным шагом заявки
  const isCurrentStepActive = stepId === currentWorkflowStepId;
  
  const showSave = !isReadOnly && !!stepId && isCurrentStepActive;

  return (
    <div className="animate-in slide-in-from-bottom duration-500 space-y-6 pb-20 w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto">
      <BlockingLoader isOpen={isSavingStatus} message="Сохраняем данные..." />

      <ConfigHeader
        building={building}
        isParking={isParking}
        isInfrastructure={isInfrastructure}
        isUnderground={typeInfo.isUnderground}
        onBack={onBack}
        showSaveButton={showSave} // Теперь это false, если вы смотрите старый шаг
        onSave={handleSave}
        saveDisabled={isSavingStatus}
        saveLabel={isSavingStatus ? 'Сохраняем…' : 'Сохранить'}
      />

      <React.Suspense fallback={<ConfiguratorViewFallback />}>
        {isParking ? (
          <ParkingView building={building} typeInfo={typeInfo} />
        ) : isInfrastructure ? (
          <InfrastructureView building={building} />
        ) : (
          <StandardView building={building} mode={mode} />
        )}
      </React.Suspense>

      <Modal
  isOpen={showWarningModal}
  onClose={() => setShowWarningModal(false)}
  title="Сохранено с предупреждениями"
  maxWidth="max-w-2xl"
>
  <div className="bg-white rounded-b-2xl space-y-4 p-6">
    {/* Banner */}
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
      <div className="shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center bg-amber-100 rounded-full">
        <AlertTriangle size={16} className="text-amber-600" />
      </div>
      <div>
        <p className="font-semibold text-amber-900 text-sm">Данные сохранены частично</p>
        <p className="text-sm text-amber-800 mt-1 leading-relaxed">
          Некоторые блоки не прошли проверку заполнения. Вы можете продолжить
          редактирование сейчас или вернуться к ним позже. Статус «Заполнено» будет
          присвоен только после исправления всех ошибок.
        </p>
      </div>
    </div>

    {/* Error list */}
    <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
      {validationWarnings.map((err, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <span className="shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full bg-amber-400" />
          <div>
            <div className="text-sm font-semibold text-slate-800">{err.title}</div>
            <div className="text-sm text-slate-500 mt-0.5 leading-snug">{err.description}</div>
          </div>
        </div>
      ))}
    </div>

    {/* Footer */}
    <div className="flex justify-end pt-1">
      <Button onClick={() => setShowWarningModal(false)}>Понятно</Button>
    </div>
  </div>
</Modal>
    </div>
  );
}
