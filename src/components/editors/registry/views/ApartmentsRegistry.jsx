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
  CheckCircle2,
  RotateCcw,
  X,
  AlertTriangle,
  Loader2,
  LayoutTemplate
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useBuildingType } from '@hooks/useBuildingType';
import { Card, DebouncedInput, Input, Label, Select, useReadOnly, Button, Modal, BlockingLoader } from '@components/ui/UIKit';
import { useToast } from '@context/ToastContext';
import { CatalogService } from '@lib/catalog-service';
import { ApiService } from '@lib/api-service';
import { formatBlockSwitcherLabel } from '@lib/building-details';
import { useProject } from '@context/ProjectContext';
import BuildingSelector from '../../BuildingSelector';
import ConfigHeader from '../../configurator/ConfigHeader';

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

// --- EXPLICATION PANEL (RIGHT SIDEBAR) ---

const ExplicationPanel = ({
  selectedUnits,
  roomTypes,
  onApplySingle,
  onApplyBulk,
  onResetExplication,
  onClearSelection,
  isSaving
}) => {
  const isReadOnly = useReadOnly();
  const toast = useToast();
  
  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    type: null,
    title: '',
    description: '' 
  });
  
  const count = selectedUnits.length;
  const isMulti = count > 1;
  const activeUnit = count === 1 ? selectedUnits[0] : null;
  
  const isDuplex = activeUnit && ['duplex_up', 'duplex_down'].includes(activeUnit.type);
  const [rooms, setRooms] = useState([]);
  const [hasMezzanine, setHasMezzanine] = useState(false);
  const [mezzanineType, setMezzanineType] = useState('internal');

  const { data: freshUnit } = useQuery({
    queryKey: ['registry-unit-explication', activeUnit?.id],
    queryFn: () => ApiService.getUnitExplicationById(activeUnit.id),
    enabled: !!activeUnit?.id && !isMulti,
  });

  useEffect(() => {
    if (isMulti || count === 0) {
      setRooms([]);
      setHasMezzanine(false);
      setMezzanineType('internal');
      return;
    }

    const sourceUnit = freshUnit || activeUnit || {};
    const source = sourceUnit.explication || [];
    setHasMezzanine(!!sourceUnit.hasMezzanine);
    setMezzanineType(sourceUnit.mezzanineType || 'internal');

    setRooms(source.map(r => ({ 
        ...r, 
        id: r.id || crypto.randomUUID(),
        level: isDuplex ? String(r.level || 1) : '1',
        isMezzanine: !!r.isMezzanine,
    })));
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
        isMezzanine: false,
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
    if (!isMulti && hasMezzanine && !rooms.some(r => r.isMezzanine)) {
      toast.error('Добавьте хотя бы одно помещение, расположенное в мезонине');
      return false;
    }
    return true;
  };

  const buildPayload = unit => ({
    ...unit,
    hasMezzanine: !isMulti ? hasMezzanine : !!unit.hasMezzanine,
    mezzanineType: (!isMulti ? hasMezzanine : !!unit.hasMezzanine)
      ? (!isMulti ? mezzanineType : unit.mezzanineType || 'internal')
      : null,
    explication: rooms.map(r => ({
      type: r.type,
      area: parseFloat(r.area),
      height: parseFloat(r.height),
      level: ['duplex_up', 'duplex_down'].includes(unit.type) ? Number(r.level || 1) : 1,
      isMezzanine: !!r.isMezzanine,
    })),
    area: stats.total,
    livingArea: stats.living,
    usefulArea: stats.useful,
    rooms: stats.rooms > 0 ? stats.rooms : unit.rooms,
  });

  const handleSaveClick = async () => {
    if (isReadOnly || isSaving) return;
    if (!validateRooms()) return;

    if (isMulti) {
      setConfirmModal({
        isOpen: true,
        type: 'save',
        title: 'Массовое заполнение',
        description: `Вы уверены, что хотите применить текущую экспликацию ко всем выбранным квартирам (${count} шт)? Это перезапишет существующие данные.`
      });
      return;
    }

    if (activeUnit) {
        await onApplySingle(buildPayload(activeUnit));
    }
  };

  const handleResetClick = async () => {
    if (isReadOnly || isSaving) return;
    setConfirmModal({
        isOpen: true,
        type: 'reset',
        title: 'Очистка данных',
        description: `Вы уверены, что хотите стереть экспликацию у выбранных квартир (${count} шт)? Данные будут удалены безвозвратно.`
    });
  };

  const performConfirmedAction = async () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    
    if (confirmModal.type === 'save') {
        await onApplyBulk(selectedUnits.map(buildPayload));
    } else if (confirmModal.type === 'reset') {
        await onResetExplication(selectedUnits);
        if (!isMulti) setRooms([]);
    }
  };

  if (count === 0) {
    return (
      <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center h-full text-slate-400 w-full lg:w-80 shrink-0">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
          <MousePointer2 size={32} className="text-slate-300" />
        </div>
        <h3 className="font-bold text-slate-600 mb-2">Мультивыбор</h3>
        <ul className="text-xs text-slate-500 text-left space-y-2 bg-slate-100 p-3 rounded-xl">
           <li className="flex gap-2">
              <span className="font-bold bg-white px-1 rounded border border-slate-200">Alt + Клик</span>
              <span>по нижнему этажу — выбрать вертикальный стояк.</span>
           </li>
           <li className="flex gap-2">
              <span className="font-bold bg-white px-1 rounded border border-slate-200">Shift + Клик</span>
              <span>по первому подъезду — выбрать горизонтальный ряд.</span>
           </li>
        </ul>
      </div>
    );
  }

  return (
    <>
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

        {!isMulti && (
          <div className="p-3 border-b border-slate-200 bg-slate-50">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={hasMezzanine}
                onChange={e => setHasMezzanine(e.target.checked)}
                disabled={isReadOnly}
              />
              В юните есть мезонин
            </label>
            {hasMezzanine && (
              <div className="mt-2">
                <Label className="text-[10px]">Тип мезонина</Label>
                <Select
                  value={mezzanineType}
                  onChange={e => setMezzanineType(e.target.value)}
                  disabled={isReadOnly}
                  className="h-8 text-xs"
                >
                  <option value="internal">Внутренний</option>
                  <option value="external">Внешний</option>
                </Select>
              </div>
            )}
          </div>
        )}
  
        {/* Rooms List */}
        <div className="flex-1 overflow-auto p-4 space-y-3 bg-slate-50/50">
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

              <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={!!room.isMezzanine}
                  onChange={e => updateRoom(room.id, 'isMezzanine', e.target.checked)}
                  disabled={isReadOnly || isMulti || !hasMezzanine}
                />
                Помещение в мезонине
              </label>
  
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
          <Button onClick={handleSaveClick} disabled={isReadOnly || isSaving} className="w-full">
            {isSaving ? (
                <><Loader2 className="animate-spin mr-2" size={16} /> Сохранение...</>
            ) : (
                isMulti ? 'Применить ко всем' : 'Сохранить'
            )}
          </Button>
          <Button variant="ghost" onClick={handleResetClick} disabled={isReadOnly || isSaving} className="w-full text-red-400 hover:text-red-600 hover:bg-red-50">
            <RotateCcw size={14} className="mr-2" /> Очистить экспликацию
          </Button>
        </div>
      </div>

      <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          title={confirmModal.title}
      >
          <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-amber-50 text-amber-900 rounded-xl border border-amber-200">
                  <AlertTriangle className="shrink-0 text-amber-600" />
                  <p className="text-sm">{confirmModal.description}</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
                      Отмена
                  </Button>
                  <Button 
                      onClick={performConfirmedAction} 
                      className={confirmModal.type === 'reset' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600'}
                  >
                      {confirmModal.type === 'reset' ? 'Да, очистить' : 'Да, применить'}
                  </Button>
              </div>
          </div>
      </Modal>
    </>
  );
};

// --- MAIN COMPONENT ---

const ApartmentsRegistry = ({ projectId, buildingId, onBack }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { buildingDetails } = useProject(); 
  
  const [internalSelectedId, setInternalSelectedId] = useState(null);
  const selectedBuildingId = buildingId || internalSelectedId;

  const { buildings } = useDirectBuildings(projectId);
  const building = useMemo(() => buildings.find(b => b.id === selectedBuildingId), [buildings, selectedBuildingId]);
  const typeInfo = useBuildingType(building);

  const [activeBlockId, setActiveBlockId] = useState(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);

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

  // --- LOGIC: SAVE UNIT ---
  const handleSaveUnit = async (originalUnit, changes, shouldInvalidate = true) => {
    try {
      const mergedData = { ...originalUnit, ...changes };
      const payload = {
        id: mergedData.id,
        floorId: mergedData.floorId,
        entranceId: mergedData.entranceId,
        num: mergedData.number || mergedData.num,
        type: mergedData.type,
        area: mergedData.area,
        livingArea: mergedData.livingArea,
        usefulArea: mergedData.usefulArea,
        rooms: mergedData.rooms,
        isSold: mergedData.isSold,
        hasMezzanine: !!mergedData.hasMezzanine,
        mezzanineType: mergedData.hasMezzanine ? mergedData.mezzanineType || 'internal' : null,
        explication: mergedData.explication || mergedData.roomsList,
      };

      await ApiService.upsertUnit(payload);
      
      if (shouldInvalidate) {
        await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
      }
      return true;
    } catch (error) {
      console.error('Save error:', error);
      if (shouldInvalidate) toast.error('Ошибка сохранения: ' + error.message);
      return false;
    }
  };

  // --- DATA LOADING ---
  const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);

  const prepared = useMemo(() => {
    if (!fullRegistry || !selectedBuildingId) {
      return { blocks: [], floorsByBlock: {}, entrancesByBlock: {}, unitsByCell: {} };
    }

    const { blocks = [], floors = [], entrances = [], units = [] } = fullRegistry;
    
    const currentBuildingBlocks = blocks.filter(b => b.buildingId === selectedBuildingId || b.building_id === selectedBuildingId);
    
    let residentialBlocks = currentBuildingBlocks.filter(b => b.type === 'Ж' || b.type === 'residential');
    
    if (residentialBlocks.length === 0 && currentBuildingBlocks.length > 0) {
        residentialBlocks = currentBuildingBlocks;
    }

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

  const bottomFloorId = useMemo(() => floors.length > 0 ? floors[floors.length - 1].id : null, [floors]);
  
  const entrances = useMemo(() => (activeBlock ? prepared.entrancesByBlock[activeBlock.id] || [] : []), [activeBlock, prepared.entrancesByBlock]);
  
  const firstEntranceId = useMemo(() => entrances.length > 0 ? entrances[0].id : null, [entrances]);

  // [NEW] Расчет статистики по подъездам для шапки
  const entranceStats = useMemo(() => {
    const stats = {};
    if (!activeBlock) return stats;

    entrances.forEach(e => {
        let total = 0;
        let filled = 0;
        
        floors.forEach(f => {
            const cellKey = `${activeBlock.id}_${f.id}_${e.id}`;
            const units = prepared.unitsByCell[cellKey] || [];
            total += units.length;
            filled += units.filter(u => u.isExplicationFilled).length;
        });

        stats[e.id] = { total, filled };
    });
    return stats;
  }, [activeBlock, entrances, floors, prepared.unitsByCell]);

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
  };

  const toggleUnit = (unitId) => {
      setSelectedUnitIds(prev => {
          const next = new Set(prev);
          if (next.has(unitId)) next.delete(unitId);
          else next.add(unitId);
          return next;
      });
  };

  const handleUnitClick = (unit, floorId, entranceId, indexInCell, event) => {
      event.stopPropagation();

      if (floorId === bottomFloorId && event.altKey) {
          const riserUnitIds = [];
          floors.forEach(f => {
              const cellKey = `${activeBlock.id}_${f.id}_${entranceId}`;
              const cellUnits = prepared.unitsByCell[cellKey] || [];
              if (cellUnits.length > indexInCell) {
                  riserUnitIds.push(cellUnits[indexInCell].id);
              }
          });

          if (riserUnitIds.length > 0) {
            setSelectedUnitIds(prev => {
                const next = new Set(prev);
                const allSelected = riserUnitIds.every(id => prev.has(id));
                if (allSelected) riserUnitIds.forEach(id => next.delete(id));
                else riserUnitIds.forEach(id => next.add(id));
                return next;
            });
            toast.success(`Выбран стояк: ${riserUnitIds.length} кв.`);
          }
      } 
      else if (entranceId === firstEntranceId && event.shiftKey) {
          const horizontalUnitIds = [];
          entrances.forEach(e => {
             const cellKey = `${activeBlock.id}_${floorId}_${e.id}`;
             const cellUnits = prepared.unitsByCell[cellKey] || [];
             if (cellUnits.length > indexInCell) {
                 horizontalUnitIds.push(cellUnits[indexInCell].id);
             }
          });

          if (horizontalUnitIds.length > 0) {
             setSelectedUnitIds(prev => {
                 const next = new Set(prev);
                 const allSelected = horizontalUnitIds.every(id => prev.has(id));
                 if (allSelected) horizontalUnitIds.forEach(id => next.delete(id));
                 else horizontalUnitIds.forEach(id => next.add(id));
                 return next;
             });
             toast.success(`Выбран ряд: ${horizontalUnitIds.length} кв.`);
          }
      }
      else {
          toggleUnit(unit.id);
      }
  };

  const applySingle = async payload => {
    setIsSaving(true);
    const success = await handleSaveUnit(payload, payload, true);
    setIsSaving(false);
    if (success) {
      toast.success('Экспликация сохранена');
      clearSelection(); 
    }
  };

  const applyBulk = async payloadList => {
    setIsSaving(true);
    try {
      const savePromises = payloadList.map(payload => 
          handleSaveUnit(payload, payload, false)
      );

      const results = await Promise.all(savePromises);
      const successCount = results.filter(Boolean).length;

      await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
      
      if (successCount === payloadList.length) {
          toast.success(`Успешно обновлено ${successCount} квартир`);
      } else {
          toast.warning(`Обновлено ${successCount} из ${payloadList.length} квартир`);
      }
      clearSelection(); 
    } catch (e) {
        console.error(e);
        toast.error('Произошла ошибка при массовом сохранении');
    } finally {
        setIsSaving(false);
    }
  };

  const resetExplication = async units => {
    setIsSaving(true);
    try {
        const resetPromises = units.map(unit => handleSaveUnit(unit, {
            ...unit,
            explication: [],
            area: 0,
            livingArea: 0,
            usefulArea: 0,
            rooms: 0,
        }, false));

        await Promise.all(resetPromises);
        await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
        
        toast.success('Сброшено');
        clearSelection(); 
    } finally {
        setIsSaving(false);
    }
  };

  // --- RENDER ---
  
  if (!selectedBuildingId) {
    return (
        <BuildingSelector 
            stepId="registry_apartments" 
            onSelect={setInternalSelectedId} 
        />
    );
  }

  if (loadingRegistry) return <div className="p-12 text-center text-slate-500">Загрузка реестра...</div>;
  if (!building) return <div className="p-12 text-center text-slate-500">Загрузка информации о здании...</div>;
  if (!activeBlock) return <div className="p-12 text-center text-slate-500">Нет блоков для отображения.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 overflow-hidden pb-4">
      
      <BlockingLoader isOpen={isSaving} message="Применение изменений..." />

      <div className="flex-none space-y-4 pb-4">
         <ConfigHeader
            building={building}
            isParking={typeInfo.isParking}
            isInfrastructure={typeInfo.isInfrastructure}
            isUnderground={typeInfo.isUnderground}
            onBack={() => {
                if (onBack) onBack(); 
                else setInternalSelectedId(null);
            }}
            isSticky={false}
            showSaveButton={false} 
         />

         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                    {formatBlockSwitcherLabel({ building, block: b, buildingDetails })} 
                  </DarkTabButton>
                ))}
             </div>

             <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></div> Готово</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-50 border border-rose-200 rounded"></div> Нет жилых комнат</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded"></div> Не заполнены комнаты</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded"></div> Выбрано</div>
             </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <Card className="flex-1 h-full border border-slate-300 shadow-md bg-white p-0 relative flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            <table className="border-collapse w-max min-w-full">
              {/* [UPDATED] Sticky Header с фоном и улучшенным UI */}
              <thead className="sticky top-0 z-30 bg-slate-100 backdrop-blur-sm shadow-sm border-b-2 border-slate-300">
                <tr>
                  <th className="p-2 sticky left-0 z-40 bg-slate-100 border-r-2 border-slate-300 w-20 text-center text-[10px] font-black text-slate-500 uppercase">
                    <div className="flex flex-col items-center gap-1">
                        <LayoutTemplate size={16} className="opacity-50" />
                        Этаж
                    </div>
                  </th>
                  {entrances.map(e => {
                    const stat = entranceStats[e.id] || { total: 0, filled: 0 };
                    const progress = stat.total > 0 ? (stat.filled / stat.total) * 100 : 0;
                    const isComplete = stat.total > 0 && stat.filled === stat.total;

                    return (
                        <th key={e.id} className="p-2 border-r-2 border-slate-300 min-w-[200px] align-bottom">
                            <div className="flex flex-col gap-2 pb-1 h-full justify-end">
                                <div className="relative flex items-center justify-center px-2 py-1">
                                    <span className="font-black text-slate-700 text-sm uppercase tracking-wide text-center">
                                        Подъезд {e.number}
                                    </span>
                                    {isComplete && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <CheckCircle2 size={18} className="text-emerald-600" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2 px-1">
                                    <div className="flex-1 bg-slate-200/80 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                        <div 
                                            className={`h-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 whitespace-nowrap tabular-nums">
                                        <span className={isComplete ? 'text-emerald-600' : 'text-slate-700'}>{stat.filled}</span>
                                        <span className="opacity-40"> / </span>
                                        <span>{stat.total}</span>
                                    </div>
                                </div>
                            </div>
                        </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {floors.map(f => (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 px-3 py-2 text-right font-bold text-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <span className="text-sm">
                            {f.label || f.index}
                        </span>
                    </td>
                    {entrances.map(e => {
                      const cellKey = `${activeBlock.id}_${f.id}_${e.id}`;
                      const cellUnits = prepared.unitsByCell[cellKey] || [];
                      
                      const isBottom = f.id === bottomFloorId;
                      const isFirstEntrance = e.id === firstEntranceId;

                      return (
                        <td
                          key={e.id}
                          className="p-2 border-r-2 border-slate-300 align-top"
                        >
                          <div className="flex flex-nowrap gap-1.5 items-center justify-start">
                            {cellUnits.length === 0 ? (
                                <span className="text-xs text-slate-300 w-full text-center py-1 block opacity-30">—</span>
                            ) : (
                                cellUnits.map((unit, unitIdx) => {
                                  const isSelected = selectedUnitIds.has(unit.id);
                                  const ready = unit.isExplicationFilled;
                                  const hasLiving = Number(unit.livingArea) > 0;
                                  
                                  let chipClass = '';
                                  if (isSelected) {
                                      chipClass = 'bg-blue-600 text-white border-blue-600 shadow-md ring-1 ring-blue-200 z-20';
                                  } else if (ready) {
                                      if (hasLiving) {
                                        chipClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                      } else {
                                        chipClass = 'bg-rose-50 text-rose-700 border-rose-200';
                                      }
                                  } else {
                                      chipClass = 'bg-white text-slate-600 border-slate-200 hover:border-blue-300';
                                  }

                                  let title = ready ? 'Заполнено' : 'Нет экспликации';
                                  if (ready && !hasLiving) title = 'Заполнено (нет жилых комнат)';
                                  
                                  if (isBottom) title = `Alt + Клик: выделить стояк\n${title}`;
                                  else if (isFirstEntrance) title = `Shift + Клик: выделить ряд\n${title}`;

                                  return (
                                    <button
                                      key={unit.id}
                                      type="button"
                                      onClick={event => handleUnitClick(unit, f.id, e.id, unitIdx, event)}
                                      className={`
                                          h-7 px-2 rounded-md text-xs font-bold border transition-all truncate min-w-[38px] max-w-[60px] flex-shrink-0
                                          ${chipClass} hover:scale-110 hover:shadow-lg hover:z-30
                                      `}
                                      title={title}
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
          isSaving={isSaving}
        />
      </div>
    </div>
  );
};

export default React.memo(ApartmentsRegistry);