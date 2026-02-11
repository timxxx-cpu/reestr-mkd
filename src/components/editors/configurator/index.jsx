import React, { useMemo, useState } from 'react';
import { useProject } from '@context/ProjectContext';
import { useBuildingType } from '@hooks/useBuildingType';

import ConfigHeader from './ConfigHeader';
// Импорты из папки views
import StandardView from './views/StandardView';
import ParkingView from './views/ParkingView';
import InfrastructureView from './views/InfrastructureView';

import {
  BLOCK_FILL_STATUS,
  validateStepCompletion,
  getStepBlocksForStatus,
  buildScopedContextForBlock,
} from '../../../lib/step-validators';
import { Modal, Button, BlockingLoader } from '../../ui/UIKit';
import { AlertTriangle } from 'lucide-react';

// [FIX] Хелпер для определения ID шага по режиму редактора
const getStepId = (mode) => {
  if (mode === 'nonres') return 'registry_nonres';
  if (mode === 'res') return 'registry_res';
  if (mode === 'floors') return 'floors'; // Добавили поддержку шага "floors"
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
  } = useProject();
  
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // 1. Находим здание
  const building = useMemo(
    () => composition.find(c => c.id === buildingId),
    [composition, buildingId]
  );

  // 2. Определяем тип
  const typeInfo = useBuildingType(building);

  // 3. Если здания нет (удалено или ошибка)
  if (!building) return <div className="p-8 text-center">Объект не найден</div>;

  const { isParking, isInfrastructure } = typeInfo;

  // Функция сбора ошибок для модального окна
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

  const handleSave = async () => {
    const stepId = getStepId(mode);
    
    // [FIX] Разрешаем сохранение, если определен stepId (включая floors)
    if (!building || !stepId) return;
    if (isReadOnly) return;

    try {
      setIsSavingStatus(true);
      setValidationWarnings([]);

      // 1. СНАЧАЛА СОХРАНЯЕМ ВСЕ ДАННЫЕ В БД
      await saveProjectImmediate();

      // 2. Затем сохраняем статусы валидации для текущего шага
      const result = await saveStepBuildingStatuses({
        stepId,
        buildingId: building.id,
      });

      // 3. Если валидация частичная, показываем предупреждения
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

  // [FIX] Логика отображения кнопки
  const stepId = getStepId(mode);
  const showSave = !isReadOnly && !!stepId;

  return (
    <div className="animate-in slide-in-from-bottom duration-500 space-y-6 pb-20 w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto">
      <BlockingLoader isOpen={isSavingStatus} message="Сохраняем данные..." />

      {/* Общая шапка */}
      <ConfigHeader
        building={building}
        isParking={isParking}
        isInfrastructure={isInfrastructure}
        isUnderground={typeInfo.isUnderground}
        onBack={onBack}
        showSaveButton={showSave} // [FIX] Используем обновленное условие
        onSave={handleSave}       // [FIX] Используем обновленный обработчик
        saveDisabled={isSavingStatus}
        saveLabel={isSavingStatus ? 'Сохраняем…' : 'Сохранить'}
      />

      {/* Роутинг по типу здания */}
      {isParking ? (
        <ParkingView building={building} typeInfo={typeInfo} />
      ) : isInfrastructure ? (
        <InfrastructureView building={building} />
      ) : (
        <StandardView building={building} mode={mode} />
      )}

      {/* Модальное окно предупреждений валидации */}
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