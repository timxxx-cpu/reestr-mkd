import React, { useMemo } from 'react';
import { ArrowLeft, Archive, Home, Save, Loader2 } from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { getBlocksList, getStageColor } from '@lib/utils';
import { formatFullIdentifier } from '@lib/uj-identifier';
import { Card, useReadOnly, SaveIndicator } from '@components/ui/UIKit';
import BasementStandardView from './views/BasementStandardView';

const COMMUNICATION_FIELDS = [
  { key: 'electricity', label: 'Электроснабжение' },
  { key: 'water', label: 'Водоснабжение' },
  { key: 'sewerage', label: 'Канализация' },
  { key: 'heating', label: 'Отопление' },
  { key: 'ventilation', label: 'Вентиляция' },
  { key: 'gas', label: 'Газоснабжение' },
  { key: 'firefighting', label: 'Пожаротушение' },
];

const buildDefaultCommunications = (source = {}) =>
  COMMUNICATION_FIELDS.reduce((acc, item) => {
    acc[item.key] = typeof source[item.key] === 'boolean' ? source[item.key] : false;
    return acc;
  }, {});

const Divider = () => <div className="w-px h-6 bg-slate-200 mx-2 shrink-0" />;

export default function BasementInventoryEditor({ buildingId, onBack }) {
  const {
    complexInfo,
    composition,
    buildingDetails,
    setBuildingDetails,
    hasUnsavedChanges,
    isSyncing,
    saveProjectImmediate // Глобальная функция сохранения
  } = useProject();

  const isReadOnly = useReadOnly();
  const projectUjCode = complexInfo?.ujCode;

  const building = useMemo(() => composition.find(b => b.id === buildingId) || null, [composition, buildingId]);
  const blocks = useMemo(() => (building ? getBlocksList(building, buildingDetails) : []), [building, buildingDetails]);

  const featuresKey = building ? `${building.id}_features` : null;
  const features = featuresKey ? buildingDetails[featuresKey] || {} : {};
  const basements = Array.isArray(features.basements) ? features.basements : [];

  const isResidentialBuilding = !!building?.category?.includes?.('residential');
  const isMultiblockResidential = isResidentialBuilding && blocks.length > 1;

  const updateBasements = next => {
    if (!featuresKey || isReadOnly) return;
    setBuildingDetails(prev => ({
      ...prev,
      [featuresKey]: { ...(prev[featuresKey] || {}), basements: next },
    }));
  };

  const updateBasementField = (id, patch) => {
    if (isReadOnly) return;
    const next = basements.map(base => (base.id === id ? { ...base, ...patch } : base));
    updateBasements(next);
  };

  const toggleCommunication = (id, field) => {
    if (isReadOnly) return;
    const target = basements.find(base => base.id === id);
    const current = buildDefaultCommunications(target?.communications || {});
    updateBasementField(id, { communications: { ...current, [field]: !current[field] } });
  };

  const toggleBlockLink = (id, blockId) => {
    if (isReadOnly) return;
    const target = basements.find(base => base.id === id);
    const linked = Array.isArray(target?.blocks) ? target.blocks : [];
    const nextBlocks = linked.includes(blockId) ? linked.filter(item => item !== blockId) : [...linked, blockId];
    updateBasementField(id, { blocks: nextBlocks, blockId: nextBlocks[0] || null });
  };

  if (!building) return <div className="p-8 text-center text-slate-400">Объект не найден.</div>;

  const fullAddress = [building.region, building.district, building.address].filter(Boolean).join(', ');
  const buildingGeometry = building?.geometry || null;

  const saveButtonClass = hasUnsavedChanges
    ? 'bg-blue-600 text-white hover:bg-blue-500 ring-2 ring-blue-500/30 border-transparent shadow-md'
    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm';

  return (
    <div className="animate-in slide-in-from-bottom duration-500 space-y-6 pb-20 w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto">
      
      {/* ШАПКА РЕДАКТОРА */}
      <div className="bg-white/95 backdrop-blur-md rounded-lg border border-slate-200 shadow-sm mb-6 sticky top-2 z-30 flex items-center justify-between px-2 h-14 overflow-hidden">
        <div className="flex items-center gap-1 overflow-hidden flex-1">
          <button onClick={onBack} className="flex items-center justify-center h-9 w-9 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0" title="Вернуться к списку">
            <ArrowLeft size={20} />
          </button>
          <Divider />

          {building.buildingCode && projectUjCode && (
            <>
              <div className="flex items-center px-3 py-1.5 bg-slate-900 rounded-md shadow-sm shrink-0">
                <span className="text-yellow-400 font-mono font-black text-sm tracking-widest">
                  {formatFullIdentifier(projectUjCode, building.buildingCode)}
                </span>
              </div>
              <Divider />
            </>
          )}

          <div className="flex flex-col justify-center min-w-[80px] shrink-0">
            <div className="flex items-center gap-1.5">
              <Home size={16} className="text-slate-500" />
              <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                {building.houseNumber ? `Дом № ${building.houseNumber}` : 'Без номера'}
              </span>
            </div>
            {fullAddress && <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={fullAddress}>{fullAddress}</div>}
          </div>

          <Divider />

          <div className="flex flex-col justify-center min-w-0 shrink flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 text-sm truncate" title={building.label}>{building.label}</span>
              <span className={`px-1.5 py-px rounded-[4px] text-[9px] font-bold uppercase tracking-wide border shrink-0 ${getStageColor(building.stage)}`}>{building.stage || 'Проект'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-blue-600 truncate mt-0.5">
              <Archive size={12} className="shrink-0 opacity-70" />
              <span className="truncate font-bold uppercase tracking-wide">Инвентаризация подвалов</span>
            </div>
          </div>
        </div>

        {/* ЛОКАЛЬНАЯ КНОПКА СОХРАНЕНИЯ (Вызывает глобальный метод) */}
        {!isReadOnly && (
          <div className="pl-2 ml-1 border-l border-slate-200 shrink-0">
            <button
              onClick={saveProjectImmediate}
              disabled={isSyncing}
              className={`relative inline-flex items-center justify-center h-9 px-4 rounded-lg text-xs font-bold transition-all border disabled:opacity-60 disabled:cursor-not-allowed ${saveButtonClass}`}
              title={hasUnsavedChanges ? "Есть несохраненные изменения" : "Сохранить"}
            >
              <SaveIndicator hasChanges={hasUnsavedChanges} />
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Save size={15} className="mr-2" />}
              {isSyncing ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      {basements.length === 0 ? (
        <Card className="p-10 border-dashed text-center text-slate-500 shadow-sm bg-slate-50/50">
          <Archive size={32} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Для этого объекта подвалы не заданы.</p>
        </Card>
      ) : (
        <BasementStandardView 
          basements={basements} 
          updateBasementField={updateBasementField} 
          isMultiblockResidential={isMultiblockResidential}
          blocks={blocks} 
          toggleBlockLink={toggleBlockLink} 
          buildDefaultCommunications={buildDefaultCommunications}
          toggleCommunication={toggleCommunication} 
          isReadOnly={isReadOnly}
          buildingGeometry={building?.geometry || null} // <-- ВАЖНО: Добавлено
          saveProjectImmediate={saveProjectImmediate}   // <-- ВАЖНО: Добавлено
        />
      )}
    </div>
  );
}