import React, { useMemo } from 'react';
import { ArrowLeft, Building2, Link2, Minus, Plus } from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { getBlocksList } from '@lib/utils';

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

  const building = useMemo(() => composition.find(b => b.id === buildingId) || null, [composition, buildingId]);
  const blocks = useMemo(() => (building ? getBlocksList(building, buildingDetails) : []), [building, buildingDetails]);

  const featuresKey = building ? `${building.id}_features` : null;
  const features = featuresKey ? buildingDetails[featuresKey] || {} : {};
  const basements = Array.isArray(features.basements) ? features.basements : [];
  const isResidentialBuilding = !!building?.category?.includes?.('residential');
  const isMultiblockResidential = isResidentialBuilding && blocks.length > 1;

  const updateBasements = next => {
    if (!featuresKey) return;
    setBuildingDetails(prev => ({
      ...prev,
      [featuresKey]: {
        ...(prev[featuresKey] || {}),
        basements: next,
      },
    }));
  };

  const updateBasementField = (id, patch) => {
    const next = basements.map(base => (base.id === id ? { ...base, ...patch } : base));
    updateBasements(next);
  };

  const toggleCommunication = (id, field) => {
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
    const target = basements.find(base => base.id === id);
    const linked = Array.isArray(target?.blocks) ? target.blocks : [];
    const nextBlocks = linked.includes(blockId) ? linked.filter(item => item !== blockId) : [...linked, blockId];
    updateBasementField(id, { blocks: nextBlocks, blockId: nextBlocks[0] || null });
  };

  if (!building) return <div className="p-8 text-center text-slate-400">Объект не найден.</div>;

  return (
    <div className="w-full px-6 pb-16 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">
          <ArrowLeft size={16} /> Назад
        </button>
        <div className="text-right">
          <h2 className="text-xl font-bold text-slate-800 inline-flex items-center gap-2"><Building2 size={20} /> Инвентаризация подвалов</h2>
          <p className="text-xs text-slate-500 mt-1">{building.label} • дом № {building.houseNumber || '—'}</p>
        </div>
      </div>

      {basements.length === 0 ? (
        <div className="p-10 rounded-2xl border border-dashed border-slate-300 text-center text-slate-500 bg-white">Для этого объекта подвалы не заданы.</div>
      ) : (
        <div className="space-y-4">
          {basements.map((base, idx) => {
            const depth = Math.min(4, Math.max(1, parseInt(base.depth, 10) || 1));
            const entrancesCount = Math.min(10, Math.max(1, parseInt(base.entrancesCount, 10) || 1));
            const communications = buildDefaultCommunications(base.communications || {});
            const linkedBlocks = Array.isArray(base.blocks) ? base.blocks : [];

            return (
              <div key={base.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800">Подвал {idx + 1}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Глубина</span>
                    <button type="button" onClick={() => updateBasementField(base.id, { depth: Math.max(1, depth - 1) })} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                      <Plus size={14} />
                    </button>
                    <div className="w-16 text-center font-bold text-slate-700">-{depth}</div>
                    <button type="button" onClick={() => updateBasementField(base.id, { depth: Math.min(4, depth + 1) })} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50">
                      <Minus size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor={`basement-entrances-${base.id}`} className="text-sm font-semibold text-slate-700 mb-2 block">Количество входов в подвал (1–10)</label>
                  <input
                    type="number"
                    id={`basement-entrances-${base.id}`}
                    min={1}
                    max={10}
                    value={entrancesCount}
                    onChange={e => {
                      const next = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1));
                      updateBasementField(base.id, { entrancesCount: next });
                    }}
                    className="w-full md:w-56 px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-700 mb-2">Коммуникации</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {COMMUNICATION_FIELDS.map(item => (
                      <label key={item.key} className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={!!communications[item.key]} onChange={() => toggleCommunication(base.id, item.key)} />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                {isMultiblockResidential && (
                  <div>
                    <div className="text-sm font-semibold text-slate-700 mb-2 inline-flex items-center gap-2"><Link2 size={14} /> Обслуживаемые блоки (обязательно)</div>
                    <div className="flex flex-wrap gap-2">
                      {blocks.map(block => {
                        const active = linkedBlocks.includes(block.id);
                        return (
                          <button key={block.id} type="button" onClick={() => toggleBlockLink(base.id, block.id)} className={`px-3 py-1.5 rounded-lg text-xs border ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>
                            {block.tabLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
