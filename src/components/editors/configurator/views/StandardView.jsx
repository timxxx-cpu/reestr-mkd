import React, { useState, useMemo, useEffect } from 'react';
import { ImageIcon, LayoutGrid } from 'lucide-react'; // Добавил иконку

// ИМПОРТЫ
import { useProject } from '@context/ProjectContext';
import { useReadOnly } from '@components/ui/UIKit'; // TabButton убрал из импорта, сделаем кастомный тут
import { getBlocksList } from '@lib/utils';
import { Validators } from '@lib/validators';
import { BuildingConfigSchema } from '@lib/schemas';
import { cleanBlockDetails } from '@lib/building-details';
import { useValidation } from '@hooks/useValidation';

// Карточки
import ConstructiveCard from '../cards/ConstructiveCard';
import EngineeringCard from '../cards/EngineeringCard';
import PhotoTab from '../PhotoTab';
import StylobateCard from '../cards/StylobateCard';
import GeneralBlockCard from '../cards/GeneralBlockCard';
import FloorsCard from '../cards/FloorsCard';
import BasementCard from '../cards/BasementCard';

// [NEW] Кастомный компонент кнопки для темной панели
const DarkTabButton = ({ active, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`
            px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${
              active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }
        `}
  >
    {Icon && <Icon size={14} className={active ? 'text-blue-200' : 'opacity-70'} />}
    {children}
  </button>
);

export default function StandardView({ building, mode }) {
  const { buildingDetails, setBuildingDetails, _complexInfo } = useProject();
  const isReadOnly = useReadOnly();

  const blocksList = useMemo(
    () => getBlocksList(building, buildingDetails),
    [building, buildingDetails]
  );

  const visibleBlocks = useMemo(() => {
    if (mode === 'res') return blocksList.filter(b => b.type === 'Ж');
    if (mode === 'nonres') return blocksList.filter(b => b.type !== 'Ж');
    return blocksList;
  }, [blocksList, mode]);

  const [activeTabId, setActiveTabId] = useState(() => {
    if (visibleBlocks.length > 0) return visibleBlocks[0].id;
    return 'photo';
  });

  useEffect(() => {
    setActiveTabId(prev => {
      const isActiveValid = prev === 'photo' || visibleBlocks.some(b => b.id === prev);
      if (isActiveValid) return prev;
      return visibleBlocks.length > 0 ? visibleBlocks[0].id : 'photo';
    });
  }, [visibleBlocks]);

  const currentBlock = blocksList.find(b => b.id === activeTabId);

  const detailsKey = currentBlock ? `${building.id}_${currentBlock.id}` : null;
  const featuresKey = `${building.id}_features`;
  const features = buildingDetails[featuresKey] || { basements: [], exploitableRoofs: [] };

  const defaultDetails = useMemo(
    () => ({
      foundation: '',
      walls: '',
      slabs: '',
      roof: '',
      seismicity: '',
      hasCustomAddress: false,
      customHouseNumber: '',
      floorsFrom: 1,
      floorsTo: '',
      entrances: '',
      elevators: '',
      commercialFloors: [],
      hasBasementFloor: false,
      hasAttic: false,
      hasLoft: false,
      hasTechnicalFloor: false,
      technicalFloors: [],
      hasExploitableRoof: false,
      parentBlocks: [],
      engineering: {
        hvs: false,
        gvs: false,
        heating: false,
        electricity: false,
        gas: false,
        sewerage: false,
        ventilation: false,
        firefighting: false,
        lowcurrent: false,
      },
    }),
    []
  );

  const details = useMemo(
    () => ({ ...defaultDetails, ...(buildingDetails[detailsKey] || {}) }),
    [defaultDetails, buildingDetails, detailsKey]
  );
  const { errors } = useValidation(BuildingConfigSchema, details);

  // ИСПРАВЛЕННЫЙ ЭФФЕКТ
  useEffect(() => {
    if (!currentBlock || !detailsKey || isReadOnly) return;

    // 1. Вычисляем, как данные должны выглядеть в идеале (без мусора)
    const cleaned = cleanBlockDetails(building, currentBlock, details);

    // 2. Берем то, что СЕЙЧАС лежит в хранилище (без дефолтных значений)
    const currentStored = buildingDetails[detailsKey] || {};

    // 3. Сравниваем: если в хранилище уже лежит чистая версия, то обновлять не нужно!
    // Это разрывает цикл перерисовок
    if (JSON.stringify(cleaned) !== JSON.stringify(currentStored)) {
      setBuildingDetails(prev => ({ ...prev, [detailsKey]: cleaned }));
    }
  }, [
    building,
    currentBlock,
    details,
    detailsKey,
    isReadOnly,
    setBuildingDetails,
    buildingDetails,
  ]);

  const updateDetail = (key, val) => {
    if (isReadOnly) return;
    if (!detailsKey) return;
    setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
  };

  const updateFeatures = updates => {
    if (isReadOnly) return;
    setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, ...updates } }));
  };

  useEffect(() => {
    if (currentBlock && !isReadOnly && detailsKey) {
      if (details.floorsFrom !== 1) {
        setBuildingDetails(prev => ({
          ...prev,
          [detailsKey]: { ...prev[detailsKey], floorsFrom: 1 },
        }));
      }
    }
  }, [currentBlock, details.floorsFrom, isReadOnly, detailsKey, setBuildingDetails]);

  const toggleParentBlock = blockId => {
    if (isReadOnly || !detailsKey) return;
    const currentParents = details.parentBlocks || [];
    const newParents = currentParents.includes(blockId)
      ? currentParents.filter(id => id !== blockId)
      : [...currentParents, blockId];

    const updates = { parentBlocks: newParents };
    if (currentBlock && newParents.length > 0 && currentBlock.type === 'Н') {
      updates.hasAttic = false;
      updates.hasLoft = false;
      updates.hasExploitableRoof = false;
    }
    setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...prev[detailsKey], ...updates } }));
  };

  const occupiedResBlocks = useMemo(() => {
    const map = {};
    blocksList.forEach(b => {
      if (b.type === 'Н' && b.id !== currentBlock?.id) {
        const key = `${building.id}_${b.id}`;
        const otherDetails = buildingDetails[key];
        if (otherDetails?.parentBlocks) {
          otherDetails.parentBlocks.forEach(parentId => {
            map[parentId] = b.tabLabel;
          });
        }
      }
    });
    return map;
  }, [buildingDetails, blocksList, currentBlock, building.id]);

  const localResBlocks = useMemo(() => blocksList.filter(b => b.type === 'Ж'), [blocksList]);

  const toggleFloorAttribute = (targetList, value) => {
    if (isReadOnly) return;
    const currentTarget = details[targetList] || [];
    const newTarget = currentTarget.includes(value)
      ? currentTarget.filter(f => f !== value)
      : [...currentTarget, value];
    updateDetail(targetList, newTarget);
  };

  const blockBasements = (features.basements || []).filter(b =>
    b.blocks?.includes(currentBlock?.id)
  );
  const canAddBasement = blockBasements.length < 3;

  const createBlockBasement = () => {
    if (isReadOnly || !canAddBasement || !currentBlock) return;
    const newB = {
      id: crypto.randomUUID(),
      depth: 1,
      hasParking: false,
      parkingLevels: {},
      blocks: [currentBlock.id],
      buildingId: building.id,
      blockId: currentBlock.id,
    };
    updateFeatures({ basements: [...(features.basements || []), newB] });
  };

  const removeBasement = id => {
    if (isReadOnly) return;
    updateFeatures({ basements: (features.basements || []).filter(b => b.id !== id) });
  };

  const updateBasement = (id, field, val) => {
    if (isReadOnly) return;
    const updatedBasements = (features.basements || []).map(b =>
      b.id === id ? { ...b, [field]: val } : b
    );
    updateFeatures({ basements: updatedBasements });
  };

  const stylobateHeightUnderCurrentBlock = useMemo(() => {
    if (currentBlock?.type !== 'Ж') return 0;
    let maxH = 0;
    blocksList.forEach(b => {
      if (b.type === 'Н') {
        const key = `${building.id}_${b.id}`;
        const bDetails = buildingDetails[key];
        if (bDetails?.parentBlocks?.includes(currentBlock.id)) {
          const h = parseInt(bDetails.floorsTo) || 0;
          if (h > maxH) maxH = h;
        }
      }
    });
    return maxH;
  }, [buildingDetails, blocksList, currentBlock, building.id]);

  const isResBasementLocked = useMemo(() => {
    if (currentBlock?.type !== 'Ж') return false;
    const stylobateBlock = blocksList.find(b => {
      if (b.type !== 'Н') return false;
      const key = `${building.id}_${b.id}`;
      const bDetails = buildingDetails[key];
      return bDetails?.parentBlocks?.includes(currentBlock.id);
    });
    if (!stylobateBlock) return false;
    const stylobateDetails = buildingDetails[`${building.id}_${stylobateBlock.id}`];
    return !!stylobateDetails?.hasBasementFloor;
  }, [blocksList, buildingDetails, currentBlock, building.id]);

  const isCommercialValid = Validators.commercialPresence(
    building,
    buildingDetails,
    blocksList,
    mode
  );
  const hasElevatorIssue = Validators.elevatorRequirement(
    false,
    false,
    details.floorsTo,
    details.elevators || 0
  );
  const isResidentialBlock = currentBlock?.type === 'Ж';
  const isStylobate = currentBlock?.type === 'Н' && (details.parentBlocks || []).length > 0;

  const isFloorFromDisabled = true;
  const errorBorder = field =>
    errors[field] ? 'border-red-500 focus:border-red-500 bg-red-50' : '';
  const floorRange = Array.from(
    {
      length:
        Math.min(parseInt(details.floorsTo) || 1, 50) - (parseInt(details.floorsFrom) || 1) + 1,
    },
    (_, i) => (parseInt(details.floorsFrom) || 1) + i
  );

  return (
    <>
      {/* [ИЗМЕНЕНО] Темная панель вкладок */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-max overflow-x-auto max-w-full mb-8 shadow-inner border border-slate-700">
        {visibleBlocks.map(block => {
          const bKey = `${building.id}_${block.id}`;
          const bDetails = buildingDetails[bKey] || {};
          const hasCustom = bDetails.hasCustomAddress && bDetails.customHouseNumber;

          const label = hasCustom
            ? `${block.tabLabel} (Дом №${building.houseNumber}) (Корпус ${bDetails.customHouseNumber})`
            : block.tabLabel;

          return (
            <DarkTabButton
              key={block.id}
              active={activeTabId === block.id}
              onClick={() => setActiveTabId(block.id)}
              icon={LayoutGrid}
            >
              {label}
            </DarkTabButton>
          );
        })}

        {/* Разделитель */}
        <div className="w-px h-6 bg-slate-700 mx-1"></div>

        <DarkTabButton
          active={activeTabId === 'photo'}
          onClick={() => setActiveTabId('photo')}
          icon={ImageIcon}
        >
          Фасад
        </DarkTabButton>
      </div>

      {activeTabId === 'photo' ? (
        <PhotoTab building={building} />
      ) : currentBlock ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start" key={currentBlock.id}>
          <div className="xl:col-span-3 space-y-6">
            <GeneralBlockCard
              details={details}
              updateDetail={updateDetail}
              building={building}
              currentBlock={currentBlock}
              hasElevatorIssue={hasElevatorIssue}
              _errorBorder={errorBorder}
            />
            <EngineeringCard details={details} updateDetail={updateDetail} />
          </div>

          <div className="xl:col-span-6 space-y-6">
            {currentBlock.type === 'Н' && localResBlocks.length > 0 && (
              <StylobateCard
                currentBlock={currentBlock}
                localResBlocks={localResBlocks}
                details={details}
                toggleParentBlock={toggleParentBlock}
                occupiedResBlocks={occupiedResBlocks}
              />
            )}

            <FloorsCard
              details={details}
              updateDetail={updateDetail}
              isFloorFromDisabled={isFloorFromDisabled}
              errorBorder={errorBorder}
              floorRange={floorRange}
              isResBasementLocked={isResBasementLocked}
              isStylobate={isStylobate}
              stylobateHeightUnderCurrentBlock={stylobateHeightUnderCurrentBlock}
              currentBlock={currentBlock}
              building={building}
              blockBasements={blockBasements}
              toggleFloorAttribute={toggleFloorAttribute}
            />

            {isResidentialBlock && !isCommercialValid && (
              <div className="text-[10px] text-red-500 bg-red-50 p-3 rounded-xl text-center border border-red-100 font-medium">
                Внимание: Укажите коммерческие этажи хотя бы в одном жилом блоке (требование
                паспорта)
              </div>
            )}
          </div>

          <div className="xl:col-span-3 space-y-6">
            <ConstructiveCard details={details} updateDetail={updateDetail} errors={errors} />
            <BasementCard
              blockBasements={blockBasements}
              canAddBasement={canAddBasement}
              createBlockBasement={createBlockBasement}
              removeBasement={removeBasement}
              updateBasement={updateBasement}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
