import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProject } from '@context/ProjectContext';
import { useBuildingType } from '@hooks/useBuildingType';

import ConfigHeader from './ConfigHeader';
import StandardView from './views/StandardView';
import ParkingView from './views/ParkingView';
import InfrastructureView from './views/InfrastructureView';

import {
  BLOCK_FILL_STATUS,
  validateStepCompletion,
  getStepBlocksForStatus,
  buildScopedContextForBlock,
} from '../../../lib/step-validators';
// [FIX] 1. Импортируем конфигурацию шагов
import { STEPS_CONFIG } from '../../../lib/constants'; 
import { Modal, Button, BlockingLoader } from '../../ui/UIKit';
import { AlertTriangle } from 'lucide-react';

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
    applicationInfo, // [FIX] 2. Достаем информацию о текущем шаге заявки
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

  // [FIX] Wait for any background queries/mutations (like DebouncedInput) to finish
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

  // [FIX] 3. Логика проверки совпадения шагов
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

      {isParking ? (
        <ParkingView building={building} typeInfo={typeInfo} />
      ) : isInfrastructure ? (
        <InfrastructureView building={building} />
      ) : (
        <StandardView building={building} mode={mode} />
      )}

      <Modal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        title="Сохранено с предупреждениями"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-yellow-50 text-yellow-900 rounded-xl border border-yellow-200">
            <AlertTriangle className="shrink-0 text-yellow-600" />
            <div>
              <p className="font-bold">Данные сохранены частично</p>
              <p className="text-sm mt-1">
                Некоторые блоки не прошли проверку заполнения. Вы можете продолжить редактирование
                сейчас или вернуться к ним позже. Статус "Заполнено" будет присвоен только после
                исправления всех ошибок.
              </p>
            </div>
          </div>

          <div className="max-h-[40vh] overflow-y-auto border rounded-xl divide-y">
            {validationWarnings.map((err, idx) => (
              <div key={idx} className="p-3 text-sm hover:bg-slate-50">
                <div className="font-bold text-slate-700">{err.title}</div>
                <div className="text-slate-500 mt-0.5">{err.description}</div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setShowWarningModal(false)}>Понятно</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}