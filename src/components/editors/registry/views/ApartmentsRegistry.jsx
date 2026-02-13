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
  Check,
  X,
  ArrowDown,
  ChevronLeft,
  ArrowRight
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings'; // [NEW]
import { Card, DebouncedInput, Input, Label, Select, useReadOnly, Button, Skeleton } from '@components/ui/UIKit';
import { useToast } from '@context/ToastContext';
import { CatalogService } from '@lib/catalog-service';
import { ApiService } from '@lib/api-service';
import { formatBlockSwitcherLabel } from '@lib/building-details';
import { useProject } from '@context/ProjectContext';

// --- STYLES & COMPONENTS ---

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

const FloorTypeBadge = ({ type }) => {
    const map = {
      residential: { color: 'bg-blue-100 text-blue-700', label: 'Жилой' },
      mixed: { color: 'bg-violet-100 text-violet-700', label: 'Жилой/Нежилой' },
      technical: { color: 'bg-amber-100 text-amber-700', label: 'Технический' },
      basement: { color: 'bg-slate-200 text-slate-600', label: 'Подвал' },
      office: { color: 'bg-emerald-100 text-emerald-700', label: 'Нежилой' },
      parking_floor: { color: 'bg-indigo-100 text-indigo-700', label: 'Паркинг' },
      stylobate: { color: 'bg-pink-100 text-pink-700', label: 'Стилобат' },
    };
    const style = map[type] || map.residential;
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${style.color}`}>
        {style.label}
      </span>
    );
};

// --- BUILDING SELECTOR CARD ---
const BuildingCard = ({ building, onClick }) => {
    return (
        <div 
            onClick={onClick}
            className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer overflow-hidden p-5 flex flex-col gap-4"
        >
            <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Building2 size={24} />
                </div>
                {building.buildingCode && (
                    <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded text-slate-500">
                        {building.buildingCode}
                    </span>
                )}
            </div>
            
            <div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1 group-hover:text-blue-700 transition-colors">
                    {building.label}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                    {building.resBlocks || 0} жилых блоков
                </p>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
                <span>Открыть реестр</span>
                <ArrowRight size={16} />
            </div>
        </div>
    );
};

// --- EXPLICATION PANEL (RIGHT SIDEBAR) ---

const ExplicationPanel = ({
  selectedUnits,
  roomTypes,
  onApplySingle,
  onApplyBulk,
  onResetExplication,
  onClearSelection
}) => {
  const isReadOnly = useReadOnly();
  const toast = useToast();
  
  const count = selectedUnits.length;
  const isMulti = count > 1;
  const activeUnit = count === 1 ? selectedUnits[0] : null;
  
  const isDuplex = activeUnit && ['duplex_up', 'duplex_down'].includes(activeUnit.type);
  const [rooms, setRooms] = useState([]);
  const [copySourceNum, setCopySourceNum] = useState('');

  const { data: freshUnit, isFetching } = useQuery({
    queryKey: ['registry-unit-explication', activeUnit?.id],
    queryFn: () => ApiService.getUnitExplicationById(activeUnit.id),
    enabled: !!activeUnit?.id && !isMulti,
  });

  useEffect(() => {
    if (isMulti || count === 0) {
      setRooms([]);
      setCopySourceNum('');
      return;
    }

    const source = freshUnit?.explication || activeUnit?.explication || [];
    setRooms(source.map(r => ({ 
        ...r, 
        id: r.id || crypto.randomUUID(),
        level: isDuplex ? String(r.level || 1) : '1' 
    })));
    setCopySourceNum('');
  }, [isMulti, freshUnit, activeUnit, isDuplex, count]);

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

  const validateRooms = () => {
    if (!rooms.length) {
      toast.error('Добавьте хотя бы одно помещение');
      return false;
    }
    const invalid = rooms.find(
      r => !r.type || !(parseFloat(r.area) > 0) || !(parseFloat(r.height) > 0)
    );
    if (invalid) {
      toast.error('Заполните тип, площадь и высоту для всех помещений');
      return false;
    }
    return true;
  };

  const buildPayload = unit => ({
    ...unit,
    explication: rooms.map(r => ({
      type: r.type,
      area: parseFloat(r.area),
      height: parseFloat(r.height),
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
      if(!confirm(`Применить эту экспликацию ко всем выбранным квартирам (${count} шт)?`)) return;
      await onApplyBulk(selectedUnits.map(buildPayload));
      return;
    }

    if (activeUnit) {
        await onApplySingle(buildPayload(activeUnit));
    }
  };

  const handleReset = async () => {
    if (isReadOnly) return;
    if (!confirm('Стереть экспликацию у выбранных квартир?')) return;
    await onResetExplication(selectedUnits);
    if (!isMulti) setRooms([]);
  };

  if (count === 0) {
    return (
      <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center h-full text-slate-400">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
          <MousePointer2 size={32} className="text-slate-300" />
        </div>
        <h3 className="font-bold text-slate-600 mb-1">Выберите квартиры</h3>
        <p className="text-sm">
            Кликните по ячейкам или отдельным квартирам в матрице.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col w-full lg:w-80 shrink-0">
      {/* Header */}
      <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
         <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
                <CheckCircle2 size={18} />
                {count} {count === 1 ? 'квартира' : 'квартир'}
            </h3>
            <p className="text-blue-100 text-xs">
                {isMulti ? 'Массовое редактирование' : `Кв. №${activeUnit?.number || activeUnit?.num || '?'}`}
            </p>
         </div>
         <button onClick={onClearSelection} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={18} />
         </button>
      </div>

      {/* Info Bar */}
      {!isMulti && (
          <div className="grid grid-cols-2 gap-px bg-slate-200 border-b border-slate-200">
            <div className="bg-slate-50 p-2 text-center">
                <span className="block text-[10px] text-slate-400 uppercase font-bold">Общая S</span>
                <span className="text-sm font-black text-slate-700">{stats.total} м²</span>
            </div>
            <div className="bg-slate-50 p-2 text-center">
                <span className="block text-[10px] text-slate-400 uppercase font-bold">Жилая S</span>
                <span className="text-sm font-black text-emerald-600">{stats.living} м²</span>
            </div>
          </div>
      )}

      {/* Rooms List */}
      <div className="flex-1 overflow-auto p-4 space-y-3 bg-slate-50/50">
        {rooms.length === 0 && (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm">Экспликация пуста</p>
                <p className="text-xs mt-1">Добавьте помещения</p>
            </div>
        )}

        {rooms.map((room, idx) => (
          <div key={room.id} className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm space-y-2 relative group">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
                <span>#{idx + 1}</span>
                {!isReadOnly && (
                    <button onClick={() => removeRoom(room.id)} className="text-red-300 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
            
            <Select 
                value={room.type} 
                onChange={e => updateRoom(room.id, 'type', e.target.value)} 
                disabled={isReadOnly}
                className="w-full text-sm font-bold"
            >
                {roomTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
            </Select>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                    <Label className="text-[9px]">Площадь</Label>
                    <DebouncedInput 
                        type="number" step="0.01" min="0" 
                        value={room.area || ''} 
                        onChange={v => updateRoom(room.id, 'area', v)} 
                        placeholder="0.00" 
                        disabled={isReadOnly}
                        className="h-8 text-sm"
                    />
                </div>
                <div className="space-y-0.5">
                    <Label className="text-[9px]">Высота</Label>
                    <DebouncedInput 
                        type="number" step="0.01" min="0" 
                        value={room.height || ''} 
                        onChange={v => updateRoom(room.id, 'height', v)} 
                        placeholder="0.00" 
                        disabled={isReadOnly}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            {isDuplex && (
                <div className="pt-1">
                    <Label className="text-[9px]">Уровень</Label>
                    <Select value={String(room.level || '1')} onChange={e => updateRoom(room.id, 'level', e.target.value)} disabled={isReadOnly} className="h-8 text-xs">
                        <option value="1">Нижний уровень</option>
                        <option value="2">Верхний уровень</option>
                    </Select>
                </div>
            )}
          </div>
        ))}

        {!isReadOnly && (
          <Button variant="secondary" onClick={addRoom} className="w-full border-dashed border-slate-300 text-slate-500">
            <Plus size={14} className="mr-1" /> Добавить
          </Button>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-white p-4 border-t border-slate-100 shadow-lg z-10 space-y-2">
        <Button onClick={handleSave} disabled={isReadOnly} className="w-full">
          {isMulti ? 'Применить ко всем' : 'Сохранить'}
        </Button>
        <Button variant="ghost" onClick={handleReset} disabled={isReadOnly} className="w-full text-red-400 hover:text-red-600 hover:bg-red-50">
          <RotateCcw size={14} className="mr-2" /> Очистить экспликацию
        </Button>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const ApartmentsRegistry = ({ onSaveUnit, projectId }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { buildingDetails } = useProject(); 
  
  // [MODIFIED] State for Building Selection
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [activeBlockId, setActiveBlockId] = useState(null);
  
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [selectedCellKeys, setSelectedCellKeys] = useState(new Set());

  // Load basic building info for selection
  const { buildings, isLoading: isBuildingsLoading } = useDirectBuildings(projectId);
  
  // Residential buildings only
  const residentialBuildings = useMemo(() => 
      buildings.filter(b => b.category.includes('residential')), 
  [buildings]);

  // --- CATALOGS ---
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

  // --- DATA LOADING (Only for selected building) ---
  // Note: useDirectIntegration loads full project data. 
  // Optimization: In real world, we should have useDirectIntegration(projectId, buildingId).
  // For now, we filter on client side as before.
  const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);

  const prepared = useMemo(() => {
    if (!fullRegistry || !selectedBuildingId) {
      return { blocks: [], floorsByBlock: {}, entrancesByBlock: {}, unitsByCell: {} };
    }

    const { blocks = [], floors = [], entrances = [], units = [] } = fullRegistry;
    
    // Filter by selected building
    const currentBuildingBlocks = blocks.filter(b => b.buildingId === selectedBuildingId || b.building_id === selectedBuildingId);
    // Also filter by type 'residential' (just in case)
    const residentialBlocks = currentBuildingBlocks.filter(b => b.type === 'Ж' || b.type === 'residential');

    const floorsByBlock = {};
    const entrancesByBlock = {};
    const unitsByCell = {};

    residentialBlocks.forEach(b => {
      floorsByBlock[b.id] = floors
        .filter(f => f.blockId === b.id)
        .sort((a, z) => (Number(z.index) || 0) - (Number(a.index) || 0));

      entrancesByBlock[b.id] = entrances
        .filter(e => e.blockId === b.id)
        .sort((a, z) => Number(a.number) - Number(z.number));
    });

    const blockMap = new Map(blocks.map(b => [b.id, b]));
    const floorMap = new Map(floors.map(f => [f.id, f]));
    const entranceMap = new Map(entrances.map(e => [e.id, e]));

    units
      .filter(u => ['flat', 'duplex_up', 'duplex_down'].includes(u.type))
      .forEach(u => {
        const floor = floorMap.get(u.floorId);
        if (!floor) return;
        
        // Ensure unit belongs to selected building blocks
        const block = blockMap.get(floor.blockId);
        if (!block || block.buildingId !== selectedBuildingId && block.building_id !== selectedBuildingId) return;

        const cellKey = `${floor.blockId}_${u.floorId}_${u.entranceId}`;
        if (!unitsByCell[cellKey]) unitsByCell[cellKey] = [];

        unitsByCell[cellKey].push({
          ...u,
          floorLabel: floor.label || floor.index,
          blockId: floor.blockId,
          blockLabel: block?.tabLabel || block?.label || '-',
          entrance: entranceMap.get(u.entranceId)?.number || '-',
          isExplicationFilled: Array.isArray(u.explication) && u.explication.length > 0,
        });
      });

    Object.values(unitsByCell).forEach(arr => {
      arr.sort((a, b) => String(a.number || a.num).localeCompare(String(b.number || b.num), 'ru', { numeric: true }));
    });

    return { blocks: residentialBlocks, floorsByBlock, entrancesByBlock, unitsByCell };
  }, [fullRegistry, selectedBuildingId]);

  // --- DERIVED STATE ---
  const activeBlock = useMemo(() => {
    if (prepared.blocks.length === 0) return null;
    const found = prepared.blocks.find(b => b.id === activeBlockId);
    return found || prepared.blocks[0];
  }, [prepared.blocks, activeBlockId]);

  useEffect(() => {
      if (activeBlock && activeBlock.id !== activeBlockId) {
          setActiveBlockId(activeBlock.id);
      }
  }, [activeBlock, activeBlockId]);

  const { matrixMap } = useDirectMatrix(activeBlock?.id);

  const floors = useMemo(() => {
      const allFloors = activeBlock ? prepared.floorsByBlock[activeBlock.id] || [] : [];
      if (!allFloors.length) return [];

      return allFloors.filter(f => {
          const hasExistingUnits = (prepared.entrancesByBlock[activeBlock.id] || []).some(e => {
              const cellKey = `${activeBlock.id}_${f.id}_${e.id}`;
              const units = prepared.unitsByCell[cellKey];
              return units && units.length > 0;
          });
          if (hasExistingUnits) return true;

          const hasPlan = (prepared.entrancesByBlock[activeBlock.id] || []).some(e => {
              const key = `${f.id}_${e.number}`;
              const plan = parseInt(matrixMap[key]?.apts || 0, 10);
              return plan > 0;
          });
          return hasPlan;
      });
  }, [activeBlock, prepared.floorsByBlock, prepared.entrancesByBlock, prepared.unitsByCell, matrixMap]);

  const entrances = useMemo(() => (activeBlock ? prepared.entrancesByBlock[activeBlock.id] || [] : []), [activeBlock, prepared.entrancesByBlock]);

  const selectedUnits = useMemo(() => {
    if (!activeBlock || selectedUnitIds.size === 0) return [];
    const units = [];
    Object.values(prepared.unitsByCell).flat().forEach(u => {
        if (selectedUnitIds.has(u.id)) {
            units.push(u);
        }
    });
    return units;
  }, [activeBlock, selectedUnitIds, prepared.unitsByCell]);

  // --- HANDLERS ---

  const clearSelection = () => {
    setSelectedUnitIds(new Set());
    setSelectedCellKeys(new Set());
  };

  const toggleUnit = (unitId) => {
      setSelectedUnitIds(prev => {
          const next = new Set(prev);
          if (next.has(unitId)) next.delete(unitId);
          else next.add(unitId);
          return next;
      });
  };

  const toggleCell = (cellKey) => {
    const cellUnits = prepared.unitsByCell[cellKey] || [];
    if (cellUnits.length === 0) return;

    setSelectedCellKeys(prev => {
        const next = new Set(prev);
        const isSelecting = !next.has(cellKey); 
        
        if (isSelecting) {
            next.add(cellKey);
            setSelectedUnitIds(currUnits => {
                const newUnits = new Set(currUnits);
                cellUnits.forEach(u => newUnits.add(u.id));
                return newUnits;
            });
        } else {
            next.delete(cellKey);
            setSelectedUnitIds(currUnits => {
                const newUnits = new Set(currUnits);
                cellUnits.forEach(u => newUnits.delete(u.id));
                return newUnits;
            });
        }
        return next;
    });
  };

  const selectFloor = floorId => {
    const cellKeys = entrances.map(e => `${activeBlock.id}_${floorId}_${e.id}`);
    const allSelected = cellKeys.every(k => selectedCellKeys.has(k));
    
    setSelectedCellKeys(prev => {
        const nextCells = new Set(prev);
        const nextUnits = new Set(selectedUnitIds);

        cellKeys.forEach(key => {
             const cellUnits = prepared.unitsByCell[key] || [];
             if (allSelected) {
                 nextCells.delete(key);
                 cellUnits.forEach(u => nextUnits.delete(u.id));
             } else {
                 nextCells.add(key);
                 cellUnits.forEach(u => nextUnits.add(u.id));
             }
        });

        setSelectedUnitIds(nextUnits);
        return nextCells;
    });
  };

  const selectEntrance = entranceId => {
    const cellKeys = floors.map(f => `${activeBlock.id}_${f.id}_${entranceId}`);
    const allSelected = cellKeys.every(k => selectedCellKeys.has(k));

    setSelectedCellKeys(prev => {
        const nextCells = new Set(prev);
        const nextUnits = new Set(selectedUnitIds);

        cellKeys.forEach(key => {
             const cellUnits = prepared.unitsByCell[key] || [];
             if (allSelected) {
                 nextCells.delete(key);
                 cellUnits.forEach(u => nextUnits.delete(u.id));
             } else {
                 nextCells.add(key);
                 cellUnits.forEach(u => nextUnits.add(u.id));
             }
        });

        setSelectedUnitIds(nextUnits);
        return nextCells;
    });
  };

  const applySingle = async payload => {
    const success = await onSaveUnit(payload, payload);
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
    toast.success(`Обновлено ${payloadList.length} квартир`);
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
    toast.success('Сброшено');
  };

  // --- RENDER: BUILDING SELECTOR MODE ---
  
  if (!selectedBuildingId) {
      if (isBuildingsLoading) return <div className="p-12 text-center text-slate-500">Загрузка зданий...</div>;
      
      return (
          <div className="animate-in fade-in space-y-6">
              <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      <Building2 size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Выберите жилое здание</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {residentialBuildings.map(b => (
                      <BuildingCard 
                          key={b.id} 
                          building={b} 
                          onClick={() => setSelectedBuildingId(b.id)} 
                      />
                  ))}
              </div>
              
              {residentialBuildings.length === 0 && (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                      <p className="text-slate-400 font-medium">Нет жилых зданий в проекте</p>
                  </div>
              )}
          </div>
      );
  }

  // --- RENDER: EDITOR MODE ---

  if (loadingRegistry) return <div className="p-12 text-center text-slate-500">Загрузка реестра...</div>;
  if (!activeBlock) return <div className="p-12 text-center text-slate-500">Нет блоков для отображения.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 overflow-hidden pb-4">
      {/* Top Controls */}
      <div className="flex-none flex items-center justify-between pb-4">
          <div className="flex items-center gap-4">
              <button 
                  onClick={() => setSelectedBuildingId(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                  title="Назад к выбору здания"
              >
                  <ChevronLeft size={20} />
              </button>
              
              <div className="h-6 w-px bg-slate-300"></div>

              <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl shadow-inner border border-slate-700 custom-scrollbar overflow-x-auto max-w-[60vw]">
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
                    {formatBlockSwitcherLabel({ building: { id: projectId }, block: b, buildingDetails })} 
                  </DarkTabButton>
                ))}
              </div>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
             <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></div> Готово</div>
             <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded"></div> Пусто</div>
             <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded"></div> Выбрано</div>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Matrix */}
        <Card className="flex-1 h-full border border-slate-300 shadow-md bg-white p-0 relative flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            <table className="border-collapse w-max min-w-full">
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="p-2 sticky left-0 z-30 bg-slate-200 border-r border-slate-300 w-20 text-center text-[10px] font-black text-slate-600 uppercase">
                    Этаж
                  </th>
                  {entrances.map(e => (
                    <th key={e.id} className="p-2 text-center border-r border-slate-300/50 min-w-[200px]">
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
                        <button onClick={() => selectFloor(f.id)} className="hover:text-blue-700">
                            {f.label || f.index}
                        </button>
                    </td>
                    {entrances.map(e => {
                      const cellKey = `${activeBlock.id}_${f.id}_${e.id}`;
                      const cellUnits = prepared.unitsByCell[cellKey] || [];
                      const isRowOrColSelected = selectedCellKeys.has(cellKey);

                      return (
                        <td
                          key={e.id}
                          className={`
                            p-2 border-r border-slate-100 align-top
                            ${isRowOrColSelected ? 'bg-blue-50/60' : ''}
                          `}
                        >
                          <div className="flex flex-nowrap gap-1.5 items-center">
                            {cellUnits.length === 0 ? (
                                <span className="text-xs text-slate-300 w-full text-center py-1 block">—</span>
                            ) : (
                                cellUnits.map(unit => {
                                  const isSelected = selectedUnitIds.has(unit.id);
                                  const ready = unit.isExplicationFilled;
                                  
                                  let chipClass = '';
                                  if (isSelected) {
                                      chipClass = 'bg-blue-600 text-white border-blue-600 shadow-md ring-1 ring-blue-200 z-20';
                                  } else if (ready) {
                                      chipClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                  } else {
                                      chipClass = 'bg-slate-100 text-slate-600 border-slate-200';
                                  }

                                  return (
                                    <button
                                      key={unit.id}
                                      type="button"
                                      onClick={event => {
                                        event.stopPropagation();
                                        toggleUnit(unit.id);
                                      }}
                                      className={`
                                          h-7 px-2 rounded text-xs font-bold border transition-all truncate min-w-[36px] max-w-[60px] flex-shrink-0
                                          ${chipClass} hover:scale-105
                                      `}
                                      title={ready ? 'Заполнено' : 'Нет экспликации'}
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
          roomTypes={roomTypes}
          onApplySingle={applySingle}
          onApplyBulk={applyBulk}
          onResetExplication={resetExplication}
          onClearSelection={clearSelection}
        />
      </div>
    </div>
  );
};

export default React.memo(ApartmentsRegistry);