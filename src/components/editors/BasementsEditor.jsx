import React, { useMemo, useEffect } from 'react';
import { ArrowLeft, Layers, Link2 } from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { Button, Input, Label, useReadOnly } from '@components/ui/UIKit';
import { getBlocksList } from '@lib/utils';

export default function BasementsEditor({ buildingId, onBack }) {
  const {
    composition,
    buildingDetails,
    setBuildingDetails,
    saveProjectImmediate,
    saveStepBuildingStatuses,
    isReadOnly,
  } = useProject();
  const ro = useReadOnly() || isReadOnly;

  const building = useMemo(() => composition.find(c => c.id === buildingId), [composition, buildingId]);

  const blocks = useMemo(() => (building ? getBlocksList(building, buildingDetails) : []), [building, buildingDetails]);
  const basementBlocks = useMemo(() => blocks.filter(block => block.type === 'B'), [blocks]);
  const serviceableBlocks = useMemo(() => blocks.filter(block => block.type !== 'B'), [blocks]);

  useEffect(() => {
    if (!building || ro || basementBlocks.length === 0) return;

    const first = basementBlocks[0];
    const detailsKey = `${building.id}_${first.id}`;
    const details = buildingDetails[detailsKey] || {};

    if ((details.parentBlocks || []).length === 0) {
      const residential = blocks.filter(block => block.type === 'Ж').map(block => block.id);
      if (residential.length > 0) {
        setBuildingDetails(prev => ({
          ...prev,
          [detailsKey]: {
            ...(prev[detailsKey] || {}),
            parentBlocks: residential,
            levelsDepth: prev[detailsKey]?.levelsDepth || 1,
          },
        }));
      }
    }
  }, [building, ro, basementBlocks, blocks, buildingDetails, setBuildingDetails]);

  if (!building) {
    return <div className="p-8 text-center text-slate-500">Объект не найден</div>;
  }

  const updateBasementDetails = (blockId, patch) => {
    const key = `${building.id}_${blockId}`;
    setBuildingDetails(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        ...patch,
      },
    }));
  };

  const toggleServedBlock = (basementBlockId, servedBlockId) => {
    const key = `${building.id}_${basementBlockId}`;
    const details = buildingDetails[key] || {};
    const current = details.parentBlocks || [];
    const next = current.includes(servedBlockId)
      ? current.filter(id => id !== servedBlockId)
      : [...current, servedBlockId];
    updateBasementDetails(basementBlockId, { parentBlocks: next });
  };

  const handleSave = async () => {
    await saveProjectImmediate({ shouldRefetch: false });
    await saveStepBuildingStatuses({ stepId: 'basements', buildingId: building.id });
  };

  return (
    <div className="w-full px-6 pb-20 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={16} /> Назад
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Инвентаризация подвалов</h2>
            <p className="text-xs text-slate-500">{building.label}</p>
          </div>
        </div>
        {!ro && <Button onClick={handleSave}>Сохранить</Button>}
      </div>

      {basementBlocks.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed text-slate-500 bg-slate-50 text-center">
          Для этого объекта подвальные блоки не созданы.
        </div>
      ) : (
        <div className="space-y-4">
          {basementBlocks.map(block => {
            const detailsKey = `${building.id}_${block.id}`;
            const details = buildingDetails[detailsKey] || {};
            const selected = details.parentBlocks || [];

            return (
              <div key={block.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Layers size={16} /> {block.tabLabel}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Глубина (уровни подземной части)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={details.levelsDepth || 1}
                      disabled={ro}
                      onChange={e =>
                        updateBasementDetails(block.id, {
                          levelsDepth: Math.max(1, parseInt(e.target.value || '1', 10) || 1),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Паркинг в подвале</Label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
                      <input
                        type="checkbox"
                        checked={!!details.hasParking}
                        disabled={ro}
                        onChange={e => updateBasementDetails(block.id, { hasParking: e.target.checked })}
                      />
                      Да, подвал используется для паркинга
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium text-slate-700">
                    <Link2 size={15} /> Обслуживаемые блоки (минимум 1)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {serviceableBlocks.map(target => (
                      <label
                        key={target.id}
                        className="flex items-center gap-2 text-sm text-slate-700 border rounded px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          disabled={ro}
                          checked={selected.includes(target.id)}
                          onChange={() => toggleServedBlock(block.id, target.id)}
                        />
                        <span>{target.tabLabel}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
