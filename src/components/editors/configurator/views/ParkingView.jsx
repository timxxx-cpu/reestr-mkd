import React from 'react';
import { Tent, Warehouse, Store, Car } from 'lucide-react';

// Импорты
import { useProject } from '@context/ProjectContext';
import { Card, SectionTitle, Label, useReadOnly } from '@components/ui/UIKit';
import { BuildingConfigSchema } from '@lib/schemas';
import { createClientId } from '@lib/utils';
import { useValidation } from '@hooks/useValidation';

// Карточки
import ConstructiveCard from '../cards/ConstructiveCard';
import EngineeringCard from '../cards/EngineeringCard';
import ParkingParametersCard from '../cards/ParkingParametersCard';
import BasementCard from '../cards/BasementCard'; // [NEW]

export default function ParkingView({ building, typeInfo }) {
  const { buildingDetails, setBuildingDetails, composition } = useProject();
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
  const canAddBasement = blockBasements.length < 1;

  const createBlockBasement = () => {
    if (isReadOnly || !canAddBasement) return;
    const newB = {
      id: createClientId(),
      depth: 1,
      blocks: [blockId],
      buildingId: building.id,
      blockId,
    };
    updateFeatures({ basements: [...(features.basements || []), newB] });
  };

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

  // --- РЕНДЕР: ОТКРЫТАЯ ПЛОЩАДКА ---
  if (isGroundOpen) {
    return (
      <div className="flex justify-center mt-10">
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
          canAddBasement={canAddBasement}
          createBasement={createBlockBasement}
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
      </div>

      <div className="xl:col-span-6 space-y-6">
        <ConstructiveCard details={details} updateDetail={updateDetail} errors={errors} />
        {isUnderground && (
          <BasementCard
            blockBasements={blockBasements}
            canAddBasement={canAddBasement}
            createBlockBasement={createBlockBasement}
            removeBasement={removeBasement}
            updateBasement={updateBasement}
          />
        )}
      </div>
    </div>
  );
}
