import React from 'react';
import { Tent, Warehouse, Store, Car } from 'lucide-react';

// Импорты
import { useProject } from '@context/ProjectContext';
import { useToast } from '@context/ToastContext';
import { Card, SectionTitle, Label, useReadOnly } from '@components/ui/UIKit';
import { BuildingConfigSchema } from '@lib/schemas';
import { useValidation } from '@hooks/useValidation';
import { ApiService } from '@lib/api-service';
import {
  createTemporaryExtensionId,
  isExtensionApiUnavailable,
  isExtensionsFeatureEnabled,
  isExtensionsLocalFallbackEnabled,
  isTemporaryExtensionId,
} from '@lib/api/extensions-api';

// Карточки
import ConstructiveCard from '../cards/ConstructiveCard';
import EngineeringCard from '../cards/EngineeringCard';
import ParkingParametersCard from '../cards/ParkingParametersCard';
import ExtensionsCard from '../cards/ExtensionsCard';

export default function ParkingView({ building, typeInfo }) {
  const { buildingDetails, setBuildingDetails, composition, setComposition, userProfile } = useProject();
  const toast = useToast();
  const isReadOnly = useReadOnly();

  const { isGroundOpen, isGroundLight, _isCapitalStructure, isUnderground } = typeInfo;

  const blockId = building.blocks?.[0]?.id || 'main';
  const detailsKey = `${building.id}_${blockId}`;
  const featuresKey = `${building.id}_features`;

  const features = buildingDetails[featuresKey] || { basements: [] };

  const defaultDetails = {
    foundation: '',
    walls: '',
    slabs: '',
    roof: '',
    seismicity: '',
    levelsDepth: '',
    floorsCount: '',
    lightStructureType: '',
    vehicleEntries: 1,
    inputs: 1,
    elevators: 0,
    parentBlocks: [],
    engineering: {
      electricity: false,
      firefighting: false,
      ventilation: false,
      hvs: false,
      heating: false,
    },
  };

  const details = { ...defaultDetails, ...(buildingDetails[detailsKey] || {}) };
  const { errors } = useValidation(BuildingConfigSchema, details);

  const updateDetail = (key, val) => {
    if (isReadOnly) return;
    setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
  };

  const updateFeatures = updates => {
    if (isReadOnly) return;
    setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, ...updates } }));
  };

  // Логика подвала (для паркингов это редкость, но архитектурно оставим)
  const blockBasements = (features.basements || []).filter(
    b => b.blockId === blockId || b.blocks?.includes(blockId)
  );
  const removeBasement = id => {
    if (isReadOnly) return;
    updateFeatures({ basements: (features.basements || []).filter(b => b.id !== id) });
  };

  const updateBasement = (id, field, val) => {
    if (isReadOnly) return;
    const updated = (features.basements || []).map(b => (b.id === id ? { ...b, [field]: val } : b));
    updateFeatures({ basements: updated });
  };

  const availableParents = composition
    .filter(c => c.id !== building.id && c.category.includes('residential'))
    .flatMap(parentBuilding =>
      (parentBuilding.blocks || [])
        .filter(block => block.type === 'residential')
        .map(block => ({
          id: block.id,
          buildingId: parentBuilding.id,
          houseNumber: parentBuilding.houseNumber,
          buildingLabel: parentBuilding.label,
          label: block.label || block.tabLabel || `Блок ${block.id?.slice?.(0, 4) || ''}`,
        }))
    );

  const toggleParentBlock = blockId => {
    if (isReadOnly) return;
    const currentParents = details.parentBlocks || [];
    const newParents = currentParents.includes(blockId)
      ? currentParents.filter(id => id !== blockId)
      : [...currentParents, blockId];
    updateDetail('parentBlocks', newParents);
  };

  const errorBorder = field =>
    errors[field] ? 'border-red-500 focus:border-red-500 bg-red-50' : '';
  const increment = (field, max = 100) =>
    updateDetail(field, Math.min(max, (parseInt(details[field]) || 0) + 1));
  const decrement = (field, min = 1) =>
    updateDetail(field, Math.max(min, (parseInt(details[field]) || 0) - 1));
  const renderCounterValue = val =>
    val === '' || val === undefined ? <span className="text-red-300">?</span> : val;


  const currentBlockModel = (building.blocks || []).find(item => item.id === blockId) || null;
  const extensionsFeatureEnabled = isExtensionsFeatureEnabled();
  const extensionsLocalFallbackEnabled = isExtensionsLocalFallbackEnabled();

  const blockExtensions = Array.isArray(currentBlockModel?.extensions) ? currentBlockModel.extensions : [];

  const updateBlockExtensionsInComposition = updater => {
    setComposition(prev =>
      (prev || []).map(item => {
        if (item.id !== building.id) return item;
        return {
          ...item,
          blocks: (item.blocks || []).map(block => {
            if (block.id !== blockId) return block;
            const nextExtensions = typeof updater === 'function' ? updater(block.extensions || []) : updater;
            return { ...block, extensions: nextExtensions };
          }),
        };
      })
    );
  };

  const createExtension = async extensionData => {
    if (!extensionsFeatureEnabled) {
      toast.warning('Функционал пристроек отключен feature-flag конфигурацией.');
      return;
    }
    const actor = { userName: userProfile?.name, userRole: userProfile?.role };
    try {
      const created = await ApiService.createBlockExtension(blockId, extensionData, actor);
      const mapped = {
        id: created?.id || createTemporaryExtensionId(),
        parentBlockId: created?.parent_block_id || blockId,
        buildingId: created?.building_id || building.id,
        label: created?.label || extensionData.label,
        extensionType: created?.extension_type || extensionData.extensionType,
        constructionKind: created?.construction_kind || extensionData.constructionKind,
        floorsCount: created?.floors_count || extensionData.floorsCount,
        startFloorIndex: created?.start_floor_index || extensionData.startFloorIndex,
        verticalAnchorType: created?.vertical_anchor_type || extensionData.verticalAnchorType,
        anchorFloorKey: created?.anchor_floor_key || extensionData.anchorFloorKey || null,
      };
      updateBlockExtensionsInComposition(prev => [...prev, mapped]);
      toast.success('Пристройка добавлена');
    } catch (e) {
      if (extensionsLocalFallbackEnabled && isExtensionApiUnavailable(e)) {
        const local = {
          id: createTemporaryExtensionId(),
          parentBlockId: blockId,
          buildingId: building.id,
          label: extensionData.label,
          extensionType: extensionData.extensionType,
          constructionKind: extensionData.constructionKind,
          floorsCount: extensionData.floorsCount,
          startFloorIndex: extensionData.startFloorIndex,
          verticalAnchorType: extensionData.verticalAnchorType,
          anchorFloorKey: extensionData.anchorFloorKey || null,
        };
        updateBlockExtensionsInComposition(prev => [...prev, local]);
        toast.warning('Backend-эндпоинт пристроек недоступен. Изменение сохранено локально.');
      } else {
        toast.error(e?.message || 'Не удалось создать пристройку');
      }
    }
  };

  const updateExtension = async (extensionId, extensionData) => {
    if (!extensionsFeatureEnabled) {
      toast.warning('Функционал пристроек отключен feature-flag конфигурацией.');
      return;
    }
    const actor = { userName: userProfile?.name, userRole: userProfile?.role };
    try {
      const updated = await ApiService.updateBlockExtension(extensionId, extensionData, actor);
      updateBlockExtensionsInComposition(prev =>
        prev.map(item =>
          item.id === extensionId
            ? {
                ...item,
                ...extensionData,
                extensionType: updated?.extension_type || extensionData.extensionType,
                constructionKind: updated?.construction_kind || extensionData.constructionKind,
                floorsCount: updated?.floors_count || extensionData.floorsCount,
                startFloorIndex: updated?.start_floor_index || extensionData.startFloorIndex,
                verticalAnchorType: updated?.vertical_anchor_type || extensionData.verticalAnchorType,
                anchorFloorKey: updated?.anchor_floor_key || extensionData.anchorFloorKey || null,
              }
            : item
        )
      );
      toast.success('Пристройка обновлена');
    } catch (e) {
      if (isTemporaryExtensionId(extensionId) || (extensionsLocalFallbackEnabled && isExtensionApiUnavailable(e))) {
        updateBlockExtensionsInComposition(prev =>
          prev.map(item => (item.id === extensionId ? { ...item, ...extensionData } : item))
        );
        toast.warning('Обновление пристройки применено локально (backend недоступен).');
      } else {
        toast.error(e?.message || 'Не удалось обновить пристройку');
      }
    }
  };

  const deleteExtension = async extensionId => {
    if (!extensionsFeatureEnabled) {
      toast.warning('Функционал пристроек отключен feature-flag конфигурацией.');
      return;
    }
    const actor = { userName: userProfile?.name, userRole: userProfile?.role };
    try {
      await ApiService.deleteBlockExtension(extensionId, actor);
      updateBlockExtensionsInComposition(prev => prev.filter(item => item.id !== extensionId));
      toast.success('Пристройка удалена');
    } catch (e) {
      if (isTemporaryExtensionId(extensionId) || (extensionsLocalFallbackEnabled && isExtensionApiUnavailable(e))) {
        updateBlockExtensionsInComposition(prev => prev.filter(item => item.id !== extensionId));
        toast.warning('Удаление пристройки применено локально (backend недоступен).');
      } else {
        toast.error(e?.message || 'Не удалось удалить пристройку');
      }
    }
  };

  // --- РЕНДЕР: ОТКРЫТАЯ ПЛОЩАДКА ---
  if (isGroundOpen) {
    return (
      <div className="space-y-6 mt-10">
        <div className="flex justify-center">
        <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center max-w-lg w-full bg-slate-50/50">
          <div className="p-6 bg-slate-100 rounded-full text-slate-300 mb-6">
            <Car size={64} />
          </div>
          <h3 className="text-2xl font-bold text-slate-700">Открытая площадка</h3>
          <p className="text-slate-500 mt-2">
            Для данного типа паркинга не требуется детальная конфигурация конструктива.
          </p>
        </Card>
        </div>
        <ExtensionsCard
          extensions={blockExtensions}
          disabled={!extensionsFeatureEnabled}
          onCreate={createExtension}
          onUpdate={updateExtension}
          onDelete={deleteExtension}
        />
      </div>
    );
  }

  // --- РЕНДЕР: ЛЕГКИЕ КОНСТРУКЦИИ ---
  if (isGroundLight) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-6 items-start">
        <Card className="p-8 shadow-md border-t-4 border-t-amber-500">
          <SectionTitle icon={Tent}>Тип конструкции</SectionTitle>
          <div className="space-y-6 mt-6">
            <Label>
              Выберите вариант исполнения <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                disabled={isReadOnly}
                onClick={() => updateDetail('lightStructureType', 'canopy')}
                className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${details.lightStructureType === 'canopy' ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300 hover:shadow-sm'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Warehouse size={32} />
                <span className="font-bold">Навесы</span>
              </button>
              <button
                disabled={isReadOnly}
                onClick={() => updateDetail('lightStructureType', 'box')}
                className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${details.lightStructureType === 'box' ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300 hover:shadow-sm'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Store size={32} />
                <span className="font-bold">Боксы</span>
              </button>
            </div>
            {errors.lightStructureType && (
              <span className="text-[10px] text-red-500 font-bold block mt-1 bg-red-50 p-2 rounded border border-red-100 text-center">
                Выберите тип конструкции
              </span>
            )}
          </div>
        </Card>

        {/* Для легких конструкций тоже может быть нужна базовая инженерия (свет) */}
        <EngineeringCard details={details} updateDetail={updateDetail} />
        <ExtensionsCard
          extensions={blockExtensions}
          disabled={!extensionsFeatureEnabled}
          onCreate={createExtension}
          onUpdate={updateExtension}
          onDelete={deleteExtension}
        />
      </div>
    );
  }

  // --- РЕНДЕР: КАПИТАЛЬНЫЙ ПАРКИНГ (3 КОЛОНКИ) ---
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-12 space-y-6">
        <ParkingParametersCard
          details={details}
          updateDetail={updateDetail}
          isUnderground={isUnderground}
          errorBorder={errorBorder}
          availableParents={availableParents}
          toggleParentBlock={toggleParentBlock}
          blockBasements={blockBasements}
          updateBasement={updateBasement}
          removeBasement={removeBasement}
          increment={increment}
          decrement={decrement}
          renderCounterValue={renderCounterValue}
        />
      </div>

      <div className="xl:col-span-6 space-y-6">
        <EngineeringCard details={details} updateDetail={updateDetail} />
        <ExtensionsCard
          extensions={blockExtensions}
          disabled={!extensionsFeatureEnabled}
          onCreate={createExtension}
          onUpdate={updateExtension}
          onDelete={deleteExtension}
        />
      </div>

      <div className="xl:col-span-6 space-y-6">
        <ConstructiveCard details={details} updateDetail={updateDetail} errors={errors} />
              </div>
    </div>
  );
}
