import React from 'react';
import { Box, ArrowUp, Footprints } from 'lucide-react';

// Импорты
import { useProject } from '@context/ProjectContext';
import { useToast } from '@context/ToastContext';
import { Card, SectionTitle, Label, Input, useReadOnly } from '@components/ui/UIKit';
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

// Наши карточки
import ConstructiveCard from '../cards/ConstructiveCard';
import EngineeringCard from '../cards/EngineeringCard';
import ExtensionsCard from '../cards/ExtensionsCard';

export default function InfrastructureView({ building }) {
  const { buildingDetails, setBuildingDetails, setComposition, userProfile } = useProject();
  const toast = useToast();
  const isReadOnly = useReadOnly();

  const blockId = building.blocks?.[0]?.id || 'main';
  const detailsKey = `${building.id}_${blockId}`;
  // Дефолтные значения
  const defaultDetails = {
    foundation: '',
    walls: '',
    slabs: '',
    roof: '',
    seismicity: '',
    floorsCount: '',
    floorsFrom: 1, // Всегда 1
    inputs: '',
    engineering: {
      hvs: false,
      gvs: false,
      heating: false,
      electricity: false,
      sewerage: false,
      ventilation: false,
      firefighting: false,
    },
  };

  const details = { ...defaultDetails, ...(buildingDetails[detailsKey] || {}) };
  const { errors } = useValidation(BuildingConfigSchema, details);

  const updateDetail = (key, val) => {
    if (isReadOnly) return;
    setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
  };

  const updateFloorsCount = e => {
    if (isReadOnly) return;
    const val = e.target.value;
    if (val === '') {
      updateDetail('floorsCount', '');
      return;
    }
    let num = parseInt(val);
    if (num > 3) num = 3; // Ограничение для ИЖС/Инфра
    setBuildingDetails(prev => ({
      ...prev,
      [detailsKey]: { ...details, floorsCount: num, floorsFrom: 1 },
    }));
  };


    const errorBorder = field =>
    errors[field] ? 'border-red-500 focus:border-red-500 bg-red-50' : '';

  const increment = (field, max = 100) =>
    updateDetail(field, Math.min(max, (details[field] === '' ? 0 : details[field]) + 1));
  const decrement = (field, min = 1) =>
    updateDetail(field, Math.max(min, (details[field] === '' ? min + 1 : details[field]) - 1));
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* ЛЕВАЯ КОЛОНКА (4/12): Основные параметры */}
      <div className="xl:col-span-4 space-y-6">
        <Card className="p-6 shadow-md border-t-4 border-t-emerald-500">
          <SectionTitle icon={Box}>Параметры объекта</SectionTitle>

          <div className="space-y-6 mt-4">
            {/* Этажность */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2" required>
                <ArrowUp size={16} className="text-emerald-600" /> Этажность (Надземная)
              </Label>
              <Input
                type="number"
                min="1"
                max="3"
                placeholder="1-3"
                value={details.floorsCount}
                onChange={updateFloorsCount}
                className={`font-bold text-lg h-12 ${errorBorder('floorsCount')}`}
                disabled={isReadOnly}
              />
              <p className="text-[10px] text-slate-400">
                Максимум 3 этажа для данного типа объектов
              </p>
            </div>

            <div className="h-px bg-slate-100 w-full" />

            {/* Входы */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Footprints size={16} className="text-slate-400" /> Количество входов
              </Label>
              <div className="flex items-center gap-3">
                <button
                  disabled={isReadOnly}
                  onClick={() => decrement('inputs', 1)}
                  className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  -
                </button>
                <span className="font-bold text-2xl w-10 text-center text-slate-700">
                  {renderCounterValue(details.inputs)}
                </span>
                <button
                  disabled={isReadOnly}
                  onClick={() => increment('inputs', 10)}
                  className="w-10 h-10 bg-white border border-slate-200 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ЦЕНТРАЛЬНАЯ КОЛОНКА (4/12): Инженерия */}
      <div className="xl:col-span-4 space-y-6">
        <EngineeringCard details={details} updateDetail={updateDetail} />
        <ExtensionsCard
          extensions={blockExtensions}
          disabled={!extensionsFeatureEnabled}
          onCreate={createExtension}
          onUpdate={updateExtension}
          onDelete={deleteExtension}
        />
      </div>

      {/* ПРАВАЯ КОЛОНКА (4/12): Конструктив + Подвал */}
      <div className="xl:col-span-4 space-y-6">
        <ConstructiveCard details={details} updateDetail={updateDetail} errors={errors} />
              </div>
    </div>
  );
}
