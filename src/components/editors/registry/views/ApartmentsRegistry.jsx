import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Car,
  Box,
  Store,
  LayoutGrid,
  MousePointer2,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { Card, DebouncedInput, Input, Label, Select, useReadOnly, Button } from '@components/ui/UIKit';
import { useToast } from '@context/ToastContext';
import { CatalogService } from '@lib/catalog-service';
import { ApiService } from '@lib/api-service';

const getBlockIcon = type => {
  if (type === 'residential') return Building2;
  if (type === 'parking') return Car;
  if (type === 'infrastructure') return Box;
  if (type === 'non_residential') return Store;
  return LayoutGrid;
};

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

const ExplicationPanel = ({
  selectedUnits,
  activeUnit,
  roomTypes,
  onApplySingle,
  onApplyBulk,
  onResetExplication,
}) => {
  const isReadOnly = useReadOnly();
  const toast = useToast();
  const isMulti = selectedUnits.length > 1;
  const isDuplex = !isMulti && ['duplex_up', 'duplex_down'].includes(activeUnit?.type);
  const [rooms, setRooms] = useState([]);
  const [copySourceNum, setCopySourceNum] = useState('');

  const { data: freshUnit, isFetching } = useQuery({
    queryKey: ['registry-unit-explication', activeUnit?.id],
    queryFn: () => ApiService.getUnitExplicationById(activeUnit.id),
    enabled: !!activeUnit?.id && !isMulti,
  });

  useEffect(() => {
    if (isMulti) {
      setRooms([]);
      setCopySourceNum('');
      return;
    }

    const source = freshUnit?.explication || activeUnit?.explication || [];
    setRooms(source.map(r => ({ ...r, level: isDuplex ? String(r.level || 1) : '1' })));
    setCopySourceNum('');
  }, [isMulti, freshUnit, activeUnit?.id, activeUnit?.explication, isDuplex]);

  const stats = useMemo(() => {
    let total = 0;
    let living = 0;
    let useful = 0;
    let livingRoomsCount = 0;

    rooms.forEach(r => {
      const rawArea = parseFloat(r.area) || 0;
      const cfg = roomTypes.find(t => t.id === r.type) || { k: 1, category: 'useful' };
      total += rawArea * cfg.k;
      if (cfg.category === 'living') {
        living += rawArea;
        livingRoomsCount += 1;
      } else if (cfg.category === 'useful') {
        useful += rawArea;
      }
    });

    return {
      total: total.toFixed(2),
      living: living.toFixed(2),
      useful: useful.toFixed(2),
      rooms: livingRoomsCount,
    };
  }, [rooms, roomTypes]);

  const addRoom = () => {
    if (isReadOnly || roomTypes.length === 0) return;
    setRooms(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: roomTypes[0].id,
        area: '',
        height: '',
        level: '1',
      },
    ]);
  };

  const removeRoom = id => {
    if (isReadOnly) return;
    setRooms(prev => prev.filter(r => r.id !== id));
  };

  const updateRoom = (id, field, value) => {
    if (isReadOnly) return;
    setRooms(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleCopy = () => {
    if (isReadOnly || isMulti || !copySourceNum.trim()) return;
    const source = selectedUnits.find(u => String(u.num || u.number) === String(copySourceNum) && u.id !== activeUnit.id);
    if (!source?.explication?.length) {
      toast.error(`Квартира №${copySourceNum} не найдена или не содержит экспликацию`);
      return;
    }

    setRooms(
      source.explication.map(r => ({
        id: crypto.randomUUID(),
        type: r.type,
        area: r.area,
        height: r.height,
        level: isDuplex ? String(r.level || 1) : '1',
      }))
    );
    setCopySourceNum('');
  };

  const validateRooms = () => {
    if (!rooms.length) {
      toast.error('Добавьте хотя бы одно помещение в экспликацию');
      return false;
    }

    const invalid = rooms.find(
      r =>
        !r.type ||
        !(parseFloat(r.area) > 0) ||
        !(parseFloat(r.height) > 0) ||
        (isDuplex && !['1', '2', 1, 2].includes(r.level))
    );

    if (invalid) {
      toast.error('Проверьте экспликацию: тип, площадь и высота обязательны');
      return false;
    }

    return true;
  };

  const buildPayload = unit => ({
    ...unit,
    explication: rooms.map(r => ({
      ...r,
      level: ['duplex_up', 'duplex_down'].includes(unit.type) ? Number(r.level || 1) : 1,
    })),
    area: stats.total,
    livingArea: stats.living,
    usefulArea: stats.useful,
    rooms: stats.rooms > 0 ? stats.rooms : unit.rooms,
  });

  const handleSave = async () => {
    if (isReadOnly) return;
    if (!validateRooms()) return;

    if (isMulti) {
      await onApplyBulk(selectedUnits.map(buildPayload));
      return;
    }

    await onApplySingle(buildPayload(activeUnit));
  };

  const handleReset = async () => {
    if (isReadOnly) return;
    if (!confirm('Стереть экспликацию у выбранных квартир?')) return;
    await onResetExplication(selectedUnits);
    setRooms([]);
  };

  if (selectedUnits.length === 0) {
    return (
      <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center h-full text-slate-400">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
          <MousePointer2 size={32} className="text-slate-300" />
        </div>
        <h3 className="font-bold text-slate-600 mb-1">Выберите ячейки/квартиры</h3>
        <p className="text-sm">Выделяйте ячейки матрицы как на шаге 5.</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-800">
              {isMulti ? `Массовое редактирование (${selectedUnits.length})` : `Квартира №${activeUnit?.number || activeUnit?.num}`}
            </h3>
            <p className="text-xs text-slate-500">
              {isMulti ? 'Поля можно заполнить и применить ко всем выбранным квартирам' : `${activeUnit?.blockLabel} • ${activeUnit?.floorLabel} • Подъезд ${activeUnit?.entrance}`}
            </p>
          </div>
          {isFetching && !isMulti && <span className="text-[11px] text-slate-500">Обновляем из БД...</span>}
        </div>
        {!isMulti && (
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="p-2 rounded bg-blue-50 text-blue-700 font-bold">Общая: {stats.total} м²</div>
            <div className="p-2 rounded bg-emerald-50 text-emerald-700 font-bold">Жилая: {stats.living} м²</div>
          </div>
        )}
      </div>

      {!isMulti && (
        <div className="p-4 border-b border-slate-100">
          <Label>Копировать экспликацию из квартиры</Label>
          <div className="flex items-center gap-2 mt-1">
            <DebouncedInput value={copySourceNum} onChange={setCopySourceNum} placeholder="Номер" />
            <Button variant="secondary" onClick={handleCopy}>
              <Copy size={14} className="mr-1" />Копировать
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {rooms.map((room, idx) => (
          <div key={room.id} className={`grid gap-2 items-center p-2 border border-slate-200 rounded-xl ${isDuplex ? 'grid-cols-12' : 'grid-cols-10'}`}>
            <div className="col-span-1 text-center text-xs font-bold text-slate-500">{idx + 1}</div>
            <div className={isDuplex ? 'col-span-3' : 'col-span-4'}>
              <Select value={room.type} onChange={e => updateRoom(room.id, 'type', e.target.value)} disabled={isReadOnly}>
                {roomTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Input type="number" step="0.01" min="0" value={room.area || ''} onChange={e => updateRoom(room.id, 'area', e.target.value)} placeholder="Пл." disabled={isReadOnly} />
            </div>
            <div className="col-span-2">
              <Input type="number" step="0.01" min="0" value={room.height || ''} onChange={e => updateRoom(room.id, 'height', e.target.value)} placeholder="Выс." disabled={isReadOnly} />
            </div>
            {isDuplex && (
              <div className="col-span-3">
                <Select value={String(room.level || '1')} onChange={e => updateRoom(room.id, 'level', e.target.value)} disabled={isReadOnly}>
                  <option value="1">1 ур.</option>
                  <option value="2">2 ур.</option>
                </Select>
              </div>
            )}
            <div className="col-span-1 text-right">
              {!isReadOnly && (
                <button onClick={() => removeRoom(room.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}

        {!isReadOnly && (
          <Button variant="secondary" onClick={addRoom} className="w-full">
            <Plus size={14} className="mr-1" />Добавить помещение
          </Button>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between">
        <Button variant="ghost" onClick={handleReset} disabled={isReadOnly}>
          <RotateCcw size={14} className="mr-1" />Сброс
        </Button>
        <Button onClick={handleSave} disabled={isReadOnly}>
          {isMulti ? 'Применить ко всем выбранным' : 'Сохранить экспликацию'}
        </Button>
      </div>
    </div>
  );
};

const ApartmentsRegistry = ({ onSaveUnit, projectId }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [activeUnitId, setActiveUnitId] = useState(null);

  const { data: roomTypesRows = [] } = useQuery({
    queryKey: ['catalog', 'dict_room_types', 'residential'],
    queryFn: () => CatalogService.getCatalog('dict_room_types'),
  });

  const roomTypes = useMemo(() => {
    const rows = (roomTypesRows || []).filter(r => r.room_scope === 'residential');
    return rows.map(r => ({
      id: r.code || r.id,
      label: r.label,
      k: Number(r.coefficient ?? r.k ?? 1),
      category: r.area_bucket || r.category || 'useful',
    }));
  }, [roomTypesRows]);

  const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);

  const prepared = useMemo(() => {
    if (!fullRegistry) {
      return { blocks: [], floorsByBlock: {}, entrancesByBlock: {}, unitsByCell: {} };
    }

    const { blocks = [], floors = [], entrances = [], units = [] } = fullRegistry;
    const residentialBlocks = blocks.filter(b => b.type === 'Ж' || b.type === 'residential');

    const floorsByBlock = {};
    residentialBlocks.forEach(b => {
      floorsByBlock[b.id] = floors
        .filter(f => f.blockId === b.id)
        .sort((a, z) => (Number(z.index) || 0) - (Number(a.index) || 0));
    });

    const entrancesByBlock = {};
    residentialBlocks.forEach(b => {
      entrancesByBlock[b.id] = entrances
        .filter(e => e.blockId === b.id)
        .sort((a, z) => Number(a.number) - Number(z.number));
    });

    const blockMap = new Map(blocks.map(b => [b.id, b]));
    const entranceMap = new Map(entrances.map(e => [e.id, e]));
    const floorMap = new Map(floors.map(f => [f.id, f]));

    const unitsByCell = {};
    units
      .filter(u => ['flat', 'duplex_up', 'duplex_down'].includes(u.type))
      .forEach(u => {
        const floor = floorMap.get(u.floorId);
        if (!floor) return;
        const block = blockMap.get(floor.blockId);
        const entrance = entranceMap.get(u.entranceId);
        const cellKey = `${floor.blockId}_${u.floorId}_${u.entranceId}`;
        if (!unitsByCell[cellKey]) unitsByCell[cellKey] = [];

        unitsByCell[cellKey].push({
          ...u,
          floorLabel: floor.label || floor.index,
          blockId: floor.blockId,
          blockLabel: block?.tabLabel || block?.label || '-',
          entrance: entrance?.number || '-',
          isExplicationFilled: Array.isArray(u.explication) && u.explication.length > 0,
        });
      });

    Object.values(unitsByCell).forEach(arr => {
      arr.sort((a, b) => String(a.number || a.num).localeCompare(String(b.number || b.num), 'ru', { numeric: true }));
    });

    return { blocks: residentialBlocks, floorsByBlock, entrancesByBlock, unitsByCell };
  }, [fullRegistry]);

  const activeBlock = useMemo(() => {
    if (prepared.blocks.length === 0) return null;
    return prepared.blocks.find(b => b.id === activeBlockId) || prepared.blocks[0];
  }, [prepared.blocks, activeBlockId]);

  const floors = useMemo(() => (activeBlock ? prepared.floorsByBlock[activeBlock.id] || [] : []), [activeBlock, prepared.floorsByBlock]);
  const entrances = useMemo(() => (activeBlock ? prepared.entrancesByBlock[activeBlock.id] || [] : []), [activeBlock, prepared.entrancesByBlock]);

  const selectedUnits = useMemo(() => {
    if (!activeBlock || selectedCells.size === 0) return [];
    const map = new Map();
    selectedCells.forEach(cellKey => {
      (prepared.unitsByCell[cellKey] || []).forEach(u => map.set(u.id, u));
    });
    return Array.from(map.values());
  }, [activeBlock, selectedCells, prepared.unitsByCell]);

  const activeUnit = useMemo(() => {
    if (!selectedUnits.length) return null;
    if (activeUnitId) {
      const found = selectedUnits.find(u => u.id === activeUnitId);
      if (found) return found;
    }
    return selectedUnits[0] || null;
  }, [selectedUnits, activeUnitId]);

  const clearSelection = () => {
    setSelectedCells(new Set());
    setActiveUnitId(null);
  };

  const toggleCell = cellKey => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(cellKey)) next.delete(cellKey);
      else next.add(cellKey);
      return next;
    });
  };

  const selectFloor = floorId => {
    const keys = entrances.map(e => `${activeBlock.id}_${floorId}_${e.id}`);
    setSelectedCells(prev => {
      const next = new Set(prev);
      const allSelected = keys.every(k => next.has(k));
      keys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const selectEntrance = entranceId => {
    const keys = floors.map(f => `${activeBlock.id}_${f.id}_${entranceId}`);
    setSelectedCells(prev => {
      const next = new Set(prev);
      const allSelected = keys.every(k => next.has(k));
      keys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const applySingle = async payload => {
    const success = await onSaveUnit(activeUnit, payload);
    if (success) {
      await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
      toast.success('Экспликация сохранена');
    }
  };

  const applyBulk = async payloadList => {
    for (const payload of payloadList) {
      await onSaveUnit(payload, payload);
    }
    await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
    toast.success(`Экспликация применена: ${payloadList.length} кв.`);
  };

  const resetExplication = async units => {
    for (const unit of units) {
      await onSaveUnit(unit, {
        ...unit,
        explication: [],
        area: 0,
        livingArea: 0,
        usefulArea: 0,
        rooms: 0,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
    toast.success(`Экспликация сброшена: ${units.length} кв.`);
  };

  if (loadingRegistry) return <div className="p-8 text-slate-500">Загрузка реестра...</div>;
  if (!activeBlock) return <div className="p-8 text-slate-500">Нет жилых блоков для реестра квартир.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl shadow-inner border border-slate-700 custom-scrollbar overflow-x-auto">
        {prepared.blocks.map(b => (
          <DarkTabButton
            key={b.id}
            active={activeBlock.id === b.id}
            onClick={() => {
              setActiveBlockId(b.id);
              clearSelection();
            }}
            icon={getBlockIcon(b.type)}
          >
            {b.tabLabel || b.label}
          </DarkTabButton>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_500px] gap-4 min-h-[70vh]">
        <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="border-collapse w-max min-w-full">
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="p-2 sticky left-0 z-30 bg-slate-200 border-r border-slate-300 w-20 text-center text-[10px] font-black text-slate-600 uppercase">
                    Этаж
                  </th>
                  {entrances.map(e => (
                    <th key={e.id} className="p-2 text-center border-r border-slate-300/50 min-w-[280px]">
                      <button onClick={() => selectEntrance(e.id)} className="font-bold hover:text-blue-700">
                        Подъезд {e.number}
                      </button>
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
                      const cellKey = `${activeBlock.id}_${f.id}_${e.id}`;
                      const cellUnits = prepared.unitsByCell[cellKey] || [];
                      const cellSelected = selectedCells.has(cellKey);

                      return (
                        <td
                          key={e.id}
                          className={`p-2 border-r border-slate-100 align-top min-w-[280px] cursor-pointer ${cellSelected ? 'bg-blue-50/60' : ''}`}
                          onClick={() => toggleCell(cellKey)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-400 font-bold">{cellUnits.length ? `${cellUnits.length} кв.` : '—'}</span>
                            {cellSelected && <CheckCircle2 size={12} className="text-blue-600" />}
                          </div>

                          <div className="flex flex-wrap gap-2 content-start">
                            {cellUnits.length === 0 ? (
                              <span className="text-xs text-slate-300">—</span>
                            ) : (
                              cellUnits.map(unit => {
                                const isActive = unit.id === activeUnit?.id;
                                const ready = unit.isExplicationFilled;
                                const base = ready
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : 'bg-slate-100 border-slate-300 text-slate-700';

                                return (
                                  <button
                                    key={unit.id}
                                    type="button"
                                    onClick={event => {
                                      event.stopPropagation();
                                      setActiveUnitId(unit.id);
                                      if (!selectedCells.has(cellKey)) toggleCell(cellKey);
                                    }}
                                    title={ready ? 'Экспликация заполнена' : 'Экспликация не заполнена'}
                                    className={`px-4 py-2 min-w-[92px] h-[54px] rounded-lg border text-base font-black transition ${base} ${isActive ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:shadow-sm'}`}
                                  >
                                    {unit.number || unit.num}
                                  </button>
                                );
                              })
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

        <ExplicationPanel
          selectedUnits={selectedUnits}
          activeUnit={activeUnit}
          roomTypes={roomTypes}
          onApplySingle={applySingle}
          onApplyBulk={applyBulk}
          onResetExplication={resetExplication}
        />
      </div>
    </div>
  );
};

export default React.memo(ApartmentsRegistry);
