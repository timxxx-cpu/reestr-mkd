import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Car,
  Box,
  Store,
  LayoutGrid,
  MousePointer2,
  CheckCircle2,
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useDirectFloors } from '@hooks/api/useDirectFloors';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix';
import { useDirectCommonAreas } from '@hooks/api/useDirectCommonAreas';
import { useBuildingType } from '@hooks/useBuildingType';
import { Card, DebouncedInput, useReadOnly, Label, Select, Button } from '@components/ui/UIKit';
import ConfigHeader from './configurator/ConfigHeader';
import { useCatalog } from '@hooks/useCatalogs';
import { MopItemSchema } from '@lib/schemas';
import { ApiService } from '@lib/api-service';
import { formatBlockSwitcherLabel } from '@lib/building-details';
import { useToast } from '@context/ToastContext';

const DarkTabButton = ({ active, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400'
        : 'text-slate-400 hover:text-white hover:bg-slate-700'
    }`}
  >
    {Icon && <Icon size={14} className={active ? 'text-blue-200' : 'opacity-70'} />}
    {children}
  </button>
);

const isLinkedStylobateFloor = floor => {
  if (!floor) return false;

  const explicitStylobate =
    !!floor.isStylobate ||
    !!floor.flags?.isStylobate ||
    floor.type === 'stylobate' ||
    floor.floorKey === 'stylobate' ||
    String(floor.floorKey || '').includes('stylobate');

  if (explicitStylobate) return true;

  const isExcluded =
    !!floor.flags?.isBasement ||
    !!floor.flags?.isRoof ||
    !!floor.flags?.isLoft ||
    !!floor.flags?.isAttic ||
    ['basement', 'roof', 'loft', 'attic', 'parking_floor'].includes(floor.type);

  return !isExcluded && (Number(floor.index) || 0) > 0;
};

const getBlockIcon = type => {
  if (type === 'residential') return Building2;
  if (type === 'parking') return Car;
  if (type === 'infrastructure') return Box;
  if (type === 'non_residential') return Store;
  return LayoutGrid;
};

export default function MopEditor({ buildingId, onBack }) {
  const toast = useToast();
  const { projectId, buildingDetails, saveStepBuildingStatuses } = useProject();
  const isReadOnly = useReadOnly();

  const { buildings } = useDirectBuildings(projectId);
  const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);
  const typeInfo = useBuildingType(building);
  const { isUnderground, isParking, isInfrastructure } = typeInfo;

  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const currentBlock = useMemo(() => building?.blocks?.[activeBlockIndex], [building, activeBlockIndex]);

  const { floors: rawFloors } = useDirectFloors(currentBlock?.id);
  const [linkedStylobateFloors, setLinkedStylobateFloors] = useState([]);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [draftRows, setDraftRows] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadLinkedStylobateFloors = async () => {
      if (!building?.blocks?.length || !currentBlock?.id || currentBlock.type !== 'residential') {
        if (!cancelled) setLinkedStylobateFloors([]);
        return;
      }

      const linkedStylobateBlocks = building.blocks.filter(block => {
        if (block.type !== 'non_residential') return false;
        const detailsKey = `${building.id}_${block.id}`;
        const details = buildingDetails?.[detailsKey] || {};
        return Array.isArray(details.parentBlocks) && details.parentBlocks.includes(currentBlock.id);
      });

      if (linkedStylobateBlocks.length === 0) {
        if (!cancelled) setLinkedStylobateFloors([]);
        return;
      }

      try {
        const floorsByBlock = await Promise.all(
          linkedStylobateBlocks.map(block => ApiService.getFloors(block.id))
        );
        const stylobateFloors = floorsByBlock.flat().filter(floor => isLinkedStylobateFloor(floor));
        if (!cancelled) setLinkedStylobateFloors(stylobateFloors);
      } catch (e) {
        console.error('Failed to load linked stylobate floors for mop', e);
        if (!cancelled) setLinkedStylobateFloors([]);
      }
    };

    loadLinkedStylobateFloors();

    return () => {
      cancelled = true;
    };
  }, [building, buildingDetails, currentBlock]);

  const linkedStylobateFloorIds = useMemo(
    () => linkedStylobateFloors.map(f => f.id).filter(Boolean),
    [linkedStylobateFloors]
  );

  const { entrances, matrixMap } = useDirectMatrix(currentBlock?.id);
  const { mops, upsertMop, deleteMop } = useDirectCommonAreas(currentBlock?.id, linkedStylobateFloorIds);
  const { options: mopTypeOptions } = useCatalog('dict_mop_types');

  const mopLabelByCode = useMemo(() => {
    const map = {};
    mopTypeOptions.forEach(o => {
      if (o?.code) map[o.code] = o.label;
    });
    return map;
  }, [mopTypeOptions]);

  const floors = useMemo(() => {
    const mergedFloors = [...(rawFloors || []), ...linkedStylobateFloors];
    const uniqueFloors = Array.from(new Map(mergedFloors.map(floor => [floor.id, floor])).values());

    return uniqueFloors
      .filter(f => !f?.isStylobate && !f?.flags?.isStylobate)
      .filter(f => {
        if (!f) return false;
        if (isParking && !isUnderground) return false;
        if (!isParking && !building?.category?.includes('residential')) return false;
        return true;
      })
      .sort((a, b) => (Number(b.index) || 0) - (Number(a.index) || 0));
  }, [rawFloors, linkedStylobateFloors, isParking, isUnderground, building?.category]);

  const mopGrid = useMemo(() => {
    const grid = {};
    mops.forEach(m => {
      if (!grid[m.floorId]) grid[m.floorId] = {};
      if (!grid[m.floorId][m.entranceId]) grid[m.floorId][m.entranceId] = [];
      grid[m.floorId][m.entranceId].push(m);
    });
    return grid;
  }, [mops]);

  useEffect(() => {
    setSelectedCells(new Set());
    setDraftRows([]);
  }, [activeBlockIndex]);

  const firstSelectedCell = useMemo(() => Array.from(selectedCells)[0] || null, [selectedCells]);

  useEffect(() => {
    if (!firstSelectedCell) {
      setDraftRows([]);
      return;
    }

    const [floorId, entranceId] = firstSelectedCell.split('_');
    const existing = (mopGrid[floorId]?.[entranceId] || []).map(m => ({
      id: m.id,
      type: m.type || '',
      area: m.area || '',
      height: m.height || '',
    }));

    if (selectedCells.size > 1) {
      setDraftRows([]);
    } else {
      setDraftRows(existing);
    }
  }, [firstSelectedCell, selectedCells, mopGrid]);

  const isStepAvailable = useMemo(
    () => (building?.category?.includes('residential') || (isParking && isUnderground)) && !!currentBlock,
    [building?.category, isParking, isUnderground, currentBlock]
  );

  const toggleCell = (floorId, entranceId) => {
    const key = `${floorId}_${entranceId}`;
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectFloor = floorId => {
    const keys = entrances.map(e => `${floorId}_${e.id}`);
    setSelectedCells(prev => {
      const next = new Set(prev);
      const allSelected = keys.every(k => next.has(k));
      keys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const selectEntrance = entranceId => {
    const keys = floors.map(f => `${f.id}_${entranceId}`);
    setSelectedCells(prev => {
      const next = new Set(prev);
      const allSelected = keys.every(k => next.has(k));
      keys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const addDraftRow = () => {
    if (isReadOnly) return;
    setDraftRows(prev => [...prev, { id: null, type: '', area: '', height: '' }]);
  };

  const removeDraftRow = idx => {
    if (isReadOnly) return;
    setDraftRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDraftRow = (idx, field, value) => {
    if (isReadOnly) return;
    setDraftRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const validateDraftRows = () => {
    if (draftRows.length === 0) {
      toast.error('Добавьте хотя бы один МОП');
      return false;
    }

    const invalid = draftRows.find(r => {
      const parsed = MopItemSchema.safeParse({
        id: r.id || undefined,
        type: r.type,
        area: r.area,
        height: r.height,
      });
      return !parsed.success || !(parseFloat(r.area) > 0) || !(parseFloat(r.height) > 0);
    });

    if (invalid) {
      toast.error('Для МОП обязательны: тип, площадь > 0 и высота > 0');
      return false;
    }

    return true;
  };

  const applyToSelected = async () => {
    if (isReadOnly) return;
    if (!validateDraftRows()) return;

    const selected = Array.from(selectedCells);
    if (selected.length === 0) {
      toast.error('Выберите хотя бы одну ячейку');
      return;
    }

    for (const key of selected) {
      const [floorId, entranceId] = key.split('_');
      const matrixKey = `${floorId}_${entrances.find(e => e.id === entranceId)?.number}`;
      const targetQty = parseInt(matrixMap[matrixKey]?.mopQty || 0, 10);
      const existing = mopGrid[floorId]?.[entranceId] || [];

      for (const m of existing) {
        await deleteMop(m.id);
      }

      if (targetQty > 0) {
        for (let i = 0; i < Math.min(targetQty, draftRows.length); i += 1) {
          const row = draftRows[i];
            await upsertMop({
            floorId,
            entranceId,
            type: row.type,
            area: row.area,
            height: row.height,
          });
        }
      }
    }

    toast.success(`Применено для ячеек: ${selected.length}`);
  };

  const resetSelected = async () => {
    if (isReadOnly) return;
    if (!confirm('Стереть МОП в выбранных ячейках?')) return;

    const selected = Array.from(selectedCells);
    for (const key of selected) {
      const [floorId, entranceId] = key.split('_');
      const existing = mopGrid[floorId]?.[entranceId] || [];
      for (const m of existing) {
        await deleteMop(m.id);
      }
    }

    toast.success(`Сброшено для ячеек: ${selected.length}`);
  };

  const handleSaveStepStatus = async () => {
    if (!building || isReadOnly) return;
    try {
      setIsSavingStatus(true);
      await saveStepBuildingStatuses({ stepId: 'mop', buildingId: building.id });
      onBack();
    } finally {
      setIsSavingStatus(false);
    }
  };

  if (!building || !currentBlock) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-180px)]">
      <ConfigHeader
        building={building}
        isParking={isParking}
        isInfrastructure={isInfrastructure}
        isUnderground={isUnderground}
        onBack={onBack}
        showSaveButton={true}
        onSave={handleSaveStepStatus}
        saveDisabled={isReadOnly || isSavingStatus}
        saveLabel={isSavingStatus ? 'Сохранение...' : 'Сохранить и выйти'}
      />

      <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl shadow-inner border border-slate-700 custom-scrollbar overflow-x-auto">
        {(building.blocks || []).map((b, i) => (
          <DarkTabButton
            key={b.id}
            active={activeBlockIndex === i}
            onClick={() => setActiveBlockIndex(i)}
            icon={getBlockIcon(b.type)}
          >
            {formatBlockSwitcherLabel({ building, block: b, buildingDetails })}
          </DarkTabButton>
        ))}
      </div>

      {isStepAvailable ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-4 min-h-0 flex-1">
          <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden min-h-0">
            <div className="overflow-auto h-full">
              <table className="border-collapse w-max min-w-full">
                <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300">
                  <tr>
                    <th className="p-2 sticky left-0 z-30 bg-slate-200 border-r border-slate-300 w-20 text-center text-[10px] font-black text-slate-600 uppercase">Этаж</th>
                    {entrances.map(e => (
                      <th key={e.id} className="p-2 text-center border-r border-slate-300/50 min-w-[240px]">
                        <button onClick={() => selectEntrance(e.id)} className="font-bold hover:text-blue-700">Подъезд {e.number}</button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {floors.map(f => (
                    <tr key={f.id} className="border-b border-slate-100">
                      <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-3 py-2 text-right font-bold text-slate-600">
                        <button onClick={() => selectFloor(f.id)} className="hover:text-blue-700">{f.label || f.index}</button>
                      </td>
                      {entrances.map(e => {
                        const key = `${f.id}_${e.id}`;
                        const selected = selectedCells.has(key);
                        const matrixKey = `${f.id}_${e.number}`;
                        const targetQty = parseInt(matrixMap[matrixKey]?.mopQty || 0, 10);
                        const currentMops = mopGrid[f.id]?.[e.id] || [];
                        const isFilled = targetQty > 0 && currentMops.length >= targetQty && currentMops.every(m => m.type && parseFloat(m.area) > 0 && parseFloat(m.height) > 0);

                        return (
                          <td key={e.id} onClick={() => toggleCell(f.id, e.id)} className={`p-2 border-r border-slate-100 align-top cursor-pointer min-w-[240px] ${selected ? 'bg-blue-50/60' : ''}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-slate-400 font-bold">{targetQty > 0 ? `План: ${targetQty}` : 'Нет МОП'}</span>
                              {selected && <CheckCircle2 size={12} className="text-blue-600" />}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {targetQty > 0 ? (
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${isFilled ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                                  {currentMops.length}/{targetQty}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-black text-slate-800">
                {selectedCells.size > 1 ? `Массовое редактирование МОП (${selectedCells.size})` : 'Редактирование МОП'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Выбирайте ячейки матрицы. Тип, площадь и высота обязательны.
              </p>
            </div>

            {selectedCells.size === 0 ? (
              <div className="flex-1 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 m-4 flex flex-col items-center justify-center text-center text-slate-400">
                <MousePointer2 size={30} className="mb-2" />
                <div className="font-bold">Выберите ячейки</div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto p-4 space-y-2">
                  {draftRows.map((row, idx) => (
                    <div key={row.id || idx} className="grid grid-cols-12 gap-2 items-center p-2 border border-slate-200 rounded-xl">
                      <div className="col-span-1 text-center text-xs font-bold text-slate-500">{idx + 1}</div>
                      <div className="col-span-4">
                        <Select value={row.type || ''} onChange={e => updateDraftRow(idx, 'type', e.target.value)} disabled={isReadOnly}>
                          <option value="">Тип</option>
                          {mopTypeOptions.map(t => (
                            <option key={t.code} value={t.label || mopLabelByCode[t.code] || t.code}>{t.label || mopLabelByCode[t.code] || t.code}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <DebouncedInput type="number" min="0" step="0.01" value={row.area || ''} onChange={v => updateDraftRow(idx, 'area', v)} placeholder="Пл." disabled={isReadOnly} />
                      </div>
                      <div className="col-span-3">
                        <DebouncedInput type="number" min="0" step="0.01" value={row.height || ''} onChange={v => updateDraftRow(idx, 'height', v)} placeholder="Выс." disabled={isReadOnly} />
                      </div>
                      <div className="col-span-1 text-right">
                        {!isReadOnly && (
                          <button onClick={() => removeDraftRow(idx)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {!isReadOnly && (
                    <Button variant="secondary" onClick={addDraftRow} className="w-full">
                      <Plus size={14} className="mr-1" />Добавить МОП
                    </Button>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between gap-2">
                  <Button variant="ghost" onClick={resetSelected} disabled={isReadOnly}>
                    <RotateCcw size={14} className="mr-1" />Сброс
                  </Button>
                  <Button onClick={applyToSelected} disabled={isReadOnly}>Применить к выбранным</Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <AlertCircle size={36} />
          </div>
          <h3 className="text-xl font-bold text-slate-700">Настройка МОП недоступна</h3>
          <p className="text-slate-500 max-w-md">
            Инвентаризация МОП производится только для жилых блоков и подземных паркингов.
          </p>
        </div>
      )}
    </div>
  );
}
