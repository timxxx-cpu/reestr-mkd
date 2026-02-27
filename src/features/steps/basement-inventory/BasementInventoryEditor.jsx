import React, { useMemo } from 'react';
import { ArrowLeft, Building2, Link2, Archive, Activity, Layers } from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { getBlocksList } from '@lib/utils';
import { Card, SectionTitle, Label, useReadOnly } from '@components/ui/UIKit';

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

export default function BasementInventoryEditor({ buildingId, onBack }) {
  const { composition, buildingDetails, setBuildingDetails } = useProject();
  const isReadOnly = useReadOnly();

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
      [featuresKey]: {
        ...(prev[featuresKey] || {}),
        basements: next,
      },
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
    updateBasementField(id, {
      communications: {
        ...current,
        [field]: !current[field],
      },
    });
  };

  const toggleBlockLink = (id, blockId) => {
    if (isReadOnly) return;
    const target = basements.find(base => base.id === id);
    const linked = Array.isArray(target?.blocks) ? target.blocks : [];
    const nextBlocks = linked.includes(blockId) ? linked.filter(item => item !== blockId) : [...linked, blockId];
    updateBasementField(id, { blocks: nextBlocks, blockId: nextBlocks[0] || null });
  };

  if (!building) return <div className="p-8 text-center text-slate-400">Объект не найден.</div>;

  return (
    <div className="w-full px-6 pb-16 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8">
        <button 
          type="button" 
          onClick={onBack} 
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={16} /> Назад
        </button>
        <div className="text-right">
          <h2 className="text-xl font-bold text-slate-800 inline-flex items-center gap-2">
            <Archive size={20} className="text-blue-600" /> Инвентаризация подвалов
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
            {building.label} • дом № {building.houseNumber || '—'}
          </p>
        </div>
      </div>

      {basements.length === 0 ? (
        <Card className="p-10 border-dashed text-center text-slate-500">
          <Archive size={32} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Для этого объекта подвалы не заданы.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {basements.map((base, idx) => {
            const depth = Math.min(4, Math.max(1, parseInt(base.depth, 10) || 1));
            const entrancesCount = Math.min(10, Math.max(1, parseInt(base.entrancesCount, 10) || 1));
            const communications = buildDefaultCommunications(base.communications || {});
            const linkedBlocks = Array.isArray(base.blocks) ? base.blocks : [];

            return (
              <Card key={base.id} className="p-6 shadow-sm">
                <SectionTitle icon={Archive}>Подвал {idx + 1}</SectionTitle>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Левая колонка: Основные параметры */}
                  <div className="space-y-6">
                    {/* Глубина */}
                    <div className="space-y-1">
                      <Label>Глубина (уровней вниз)</Label>
                      <div className="flex items-center gap-3">
                        <button
                          disabled={isReadOnly}
                          onClick={() => updateBasementField(base.id, { depth: Math.max(1, depth - 1) })}
                          className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          -
                        </button>
                        <span className="font-bold text-lg w-8 text-center">{depth}</span>
                        <button
                          disabled={isReadOnly}
                          onClick={() => updateBasementField(base.id, { depth: Math.min(4, depth + 1) })}
                          className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Входы */}
                    <div className="space-y-1">
                      <Label>Количество входов в подвал (макс. 10)</Label>
                      <div className="flex items-center gap-3">
                        <button
                          disabled={isReadOnly}
                          onClick={() => updateBasementField(base.id, { entrancesCount: Math.max(1, entrancesCount - 1) })}
                          className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          -
                        </button>
                        <span className="font-bold text-lg w-8 text-center">{entrancesCount}</span>
                        <button
                          disabled={isReadOnly}
                          onClick={() => updateBasementField(base.id, { entrancesCount: Math.min(10, entrancesCount + 1) })}
                          className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Обслуживаемые блоки */}
                    {isMultiblockResidential && (
                      <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                        <Label className="text-blue-900 flex items-center gap-2 mb-3">
                          <Link2 size={16} className="text-blue-500" /> Обслуживаемые блоки (обязательно)
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {blocks.map(block => {
                            const active = linkedBlocks.includes(block.id);
                            return (
                              <button
                                key={block.id}
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => toggleBlockLink(base.id, block.id)}
                                className={`
                                  px-3 py-2 rounded-lg text-xs font-bold transition-all border 
                                  ${active 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                    : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
                                  } 
                                  ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                              >
                                {block.tabLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Правая колонка: Инженерия */}
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 text-slate-700 font-bold mb-4">
                        <Activity size={18} className="text-emerald-500" />
                        Инженерные коммуникации
                     </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {COMMUNICATION_FIELDS.map(item => (
                        <label
                          key={item.key}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 transition-colors ${
                            isReadOnly ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-emerald-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isReadOnly}
                            checked={!!communications[item.key]}
                            onChange={() => toggleCommunication(base.id, item.key)}
                            className="rounded text-emerald-600 w-4 h-4 focus:ring-emerald-500 disabled:cursor-not-allowed transition-all"
                          />
                          <span className="text-xs font-bold text-slate-600 select-none">
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}