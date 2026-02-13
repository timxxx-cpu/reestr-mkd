import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase,
  FileText,
  Building2,
  School,
  CheckCircle2,
  Loader2,
  Search,
  ArrowLeft,
  Car,
  Box,
  Store,
  LayoutGrid,
  LayoutTemplate,
  MousePointer2,
  Plus,
  Trash2,
  RotateCcw,
  X,
  AlertTriangle,
  Wand2 // [NEW] Иконка для кнопки
} from 'lucide-react';
import { Card, DebouncedInput, useReadOnly, Button, Select, Label, Input, Modal, BlockingLoader } from '@components/ui/UIKit';
import EmptyState from '@components/ui/EmptyState';
import { FullIdentifierCompact } from '@components/ui/IdentifierBadge';
import { formatFullIdentifier } from '@lib/uj-identifier';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix';
import { useBuildingType } from '@hooks/useBuildingType';
import { useProject } from '@context/ProjectContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CatalogService } from '@lib/catalog-service';
import { ApiService } from '@lib/api-service';
import { useToast } from '@context/ToastContext';
import ConfigHeader from '../../configurator/ConfigHeader';
import BuildingSelector from '../../BuildingSelector';
import { formatBlockSwitcherLabel } from '@lib/building-details';

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

const getTypeConfig = type => {
  switch (type) {
    case 'office': return { label: 'Офис', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Briefcase };
    case 'office_inventory': return { label: 'Нежилое', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: FileText };
    case 'non_res_block': return { label: 'Блок', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Building2 };
    case 'infrastructure': return { label: 'Инфра', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: School };
    case 'pantry': return { label: 'Кладовая', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: FileText };
    default: return { label: type || 'Прочее', color: 'bg-slate-100 text-slate-600', icon: FileText };
  }
};

const RESIDENTIAL_UNIT_TYPES = new Set(['flat', 'duplex_up', 'duplex_down']);

// --- EXPLICATION PANEL (SINGLE MODE) ---

const ExplicationPanel = ({
  activeUnit,
  roomTypes,
  onApplySingle,
  onResetExplication,
  onClearSelection,
  isSaving
}) => {
  const isReadOnly = useReadOnly();
  const toast = useToast();
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, title: '', description: '' });
  const [rooms, setRooms] = useState([]);
  const [hasMezzanine, setHasMezzanine] = useState(false);
  const [mezzanineType, setMezzanineType] = useState('internal');

  // Всегда запрашиваем свежие данные из БД (staleTime: 0)
  const { data: freshUnit, isLoading: isUnitLoading } = useQuery({
    queryKey: ['registry-unit-explication', activeUnit?.id],
    queryFn: () => ApiService.getUnitExplicationById(activeUnit.id),
    enabled: !!activeUnit?.id,
    staleTime: 0, 
  });

  useEffect(() => {
    if (!activeUnit?.id || isUnitLoading) {
      setRooms([]);
      setHasMezzanine(false);
      setMezzanineType('internal');
      return;
    }

    if (freshUnit) {
      const source = freshUnit.explication || [];
      setHasMezzanine(!!freshUnit.hasMezzanine);
      setMezzanineType(freshUnit.mezzanineType || 'internal');
      setRooms(source.map(r => ({ 
          ...r, 
          id: r.id || crypto.randomUUID(),
          level: '1',
          isMezzanine: !!r.isMezzanine,
      })));
    }
  }, [freshUnit, activeUnit?.id, isUnitLoading]);

  const stats = useMemo(() => {
    let total = 0;
    let main = 0; 
    let aux = 0;

    rooms.forEach(r => {
      const rawArea = parseFloat(r.area) || 0;
      const cfg = roomTypes.find(t => t.id === r.type) || { k: 1, category: 'auxiliary' };
      total += rawArea * (cfg.k || 1);
      
      if (cfg.category === 'main' || cfg.category === 'living') {
        main += rawArea;
      } else {
        aux += rawArea;
      }
    });

    return {
      total: total.toFixed(2),
      main: main.toFixed(2),
      aux: aux.toFixed(2),
      roomsCount: rooms.length,
    };
  }, [rooms, roomTypes]);

  const addRoom = () => {
    if (isReadOnly || roomTypes.length === 0) return;
    setRooms(prev => [...prev, { id: crypto.randomUUID(), type: roomTypes[0].id, area: '', height: '', level: '1', isMezzanine: false }]);
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
    const invalid = rooms.find(r => !r.type || !(parseFloat(r.area) > 0));
    if (invalid) {
      toast.error('Заполните тип и площадь для всех помещений');
      return false;
    }
    if (hasMezzanine && !rooms.some(r => r.isMezzanine)) {
      toast.error('Добавьте хотя бы одно помещение, расположенное в мезонине');
      return false;
    }
    return true;
  };

  const buildPayload = unit => ({
    ...unit,
    hasMezzanine,
    mezzanineType: hasMezzanine ? mezzanineType : null,
    explication: rooms.map(r => ({
      type: r.type,
      area: parseFloat(r.area),
      height: parseFloat(r.height) || null,
      level: 1,
      isMezzanine: !!r.isMezzanine,
    })),
    area: stats.total,
    livingArea: stats.main,
    usefulArea: (parseFloat(stats.main) + parseFloat(stats.aux)).toFixed(2),
    rooms: stats.roomsCount > 0 ? stats.roomsCount : unit.rooms,
  });

  const handleSaveClick = async () => {
    if (isReadOnly || isSaving || isUnitLoading) return;
    if (!validateRooms()) return;
    if (activeUnit) await onApplySingle(buildPayload(activeUnit));
  };

  const handleResetClick = async () => {
    if (isReadOnly || isSaving || isUnitLoading) return;
    setConfirmModal({
        isOpen: true,
        type: 'reset',
        title: 'Очистка данных',
        description: `Стереть экспликацию у помещения ${activeUnit.number}?`
    });
  };

  const performConfirmedAction = async () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    if (confirmModal.type === 'reset') {
        await onResetExplication([activeUnit]);
        setRooms([]);
    }
  };

  if (!activeUnit) {
    return (
      <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center h-full text-slate-400 w-full lg:w-80 shrink-0">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
          <MousePointer2 size={32} className="text-slate-300" />
        </div>
        <h3 className="font-bold text-slate-600 mb-2">Выберите объект</h3>
        <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
            Кликните по ячейке в таблице или списке для редактирования.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col w-full lg:w-80 shrink-0">
        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
           <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                  <Briefcase size={18} />
                  Пом. {activeUnit.number}
              </h3>

              {activeUnit.unitCode && (
                <div className="text-[10px] font-mono text-white mt-1 bg-white/20 px-1.5 py-0.5 rounded w-fit select-all shadow-sm">
                   {activeUnit.unitCode}
                </div>
              )}

              <p className="text-blue-100 text-xs mt-1">
                  {isUnitLoading ? 'Загрузка из БД...' : 'Редактирование экспликации'}
              </p>
           </div>
           <button onClick={onClearSelection} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={18} />
           </button>
        </div>
  
        <div className="grid grid-cols-2 gap-px bg-slate-200 border-b border-slate-200">
          <div className="bg-slate-50 p-2 text-center">
              <span className="block text-[10px] text-slate-400 uppercase font-bold">Общая S</span>
              <span className="text-sm font-black text-slate-700">{stats.total} м²</span>
          </div>
          <div className="bg-slate-50 p-2 text-center">
              <span className="block text-[10px] text-slate-400 uppercase font-bold">Основная S</span>
              <span className="text-sm font-black text-emerald-600">{stats.main} м²</span>
          </div>
        </div>

        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={hasMezzanine}
              onChange={e => setHasMezzanine(e.target.checked)}
              disabled={isReadOnly || isUnitLoading}
            />
            В юните есть мезонин
          </label>
          {hasMezzanine && (
            <div className="mt-2">
              <Label className="text-[10px]">Тип мезонина</Label>
              <Select
                value={mezzanineType}
                onChange={e => setMezzanineType(e.target.value)}
                disabled={isReadOnly || isUnitLoading}
                className="h-8 text-xs"
              >
                <option value="internal">Внутренний</option>
                <option value="external">Внешний</option>
              </Select>
            </div>
          )}
        </div>
  
        {isUnitLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="text-xs font-medium">Получение данных...</p>
            </div>
        ) : (
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
                    disabled={isReadOnly || isUnitLoading || !hasMezzanine}
                  />
                  Помещение в мезонине
                </label>
                </div>
            ))}
    
            {!isReadOnly && (
                <Button variant="secondary" onClick={addRoom} className="w-full border-dashed border-slate-300 text-slate-500">
                <Plus size={14} className="mr-1" /> Добавить
                </Button>
            )}
            </div>
        )}
  
        <div className="bg-white p-4 border-t border-slate-100 shadow-lg z-10 space-y-2">
          <Button onClick={handleSaveClick} disabled={isReadOnly || isSaving || isUnitLoading} className="w-full">
            {isSaving ? <><Loader2 className="animate-spin mr-2" size={16} /> Сохранение...</> : 'Сохранить'}
          </Button>
          <Button variant="ghost" onClick={handleResetClick} disabled={isReadOnly || isSaving || isUnitLoading} className="w-full text-red-400 hover:text-red-600 hover:bg-red-50">
            <RotateCcw size={14} className="mr-2" /> Очистить
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
                  <Button variant="ghost" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>Отмена</Button>
                  <Button onClick={performConfirmedAction} className="bg-red-600">
                      Очистить
                  </Button>
              </div>
          </div>
      </Modal>
    </>
  );
};

// --- MAIN COMPONENT ---

const CommercialRegistry = ({ projectId, buildingId, onBack }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { complexInfo, buildingDetails } = useProject();
  
  const [internalSelectedId, setInternalSelectedId] = useState(null);
  const selectedBuildingId = buildingId || internalSelectedId;
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection State (Single ID)
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);
  const { buildings } = useDirectBuildings(projectId);
  const isReadOnly = useReadOnly();
  
  const building = useMemo(() => buildings.find(b => b.id === selectedBuildingId), [buildings, selectedBuildingId]);
  const typeInfo = useBuildingType(building);

  // Catalogs - FILTERED FOR COMMERCIAL
  const { data: roomTypesRows = [] } = useQuery({
    queryKey: ['catalog', 'dict_room_types', 'commercial'],
    queryFn: () => CatalogService.getCatalog('dict_room_types'),
  });

  const roomTypes = useMemo(() => {
    return roomTypesRows
      .filter(r => r.room_scope === 'commercial')
      .map(r => ({
        id: r.code || r.id,
        label: r.label,
        k: Number(r.coefficient ?? r.k ?? 1),
        category: r.area_bucket || r.category || 'auxiliary',
      }));
  }, [roomTypesRows]);

  useEffect(() => {
    if (building?.blocks?.length > 0 && !activeBlockId) {
      const nonRes = building.blocks.find(b => b.type === 'non_residential' || b.type === 'infrastructure');
      setActiveBlockId(nonRes ? nonRes.id : building.blocks[0].id);
    } else if (building && (!building.blocks || building.blocks.length === 0)) {
        setActiveBlockId(null);
    }
  }, [building, activeBlockId]);

  const activeBlock = useMemo(() => {
      if (!building?.blocks) return null;
      return building.blocks.find(b => b.id === activeBlockId) || building.blocks[0];
  }, [building, activeBlockId]);

  const { matrixMap } = useDirectMatrix(activeBlock?.id);

  // --- DATA PREPARATION ---
  const { listData, matrixData, stats, commercialUnits } = useMemo(() => {
    if (!fullRegistry || !fullRegistry.units) return { listData: [], matrixData: null, stats: null, commercialUnits: [] };

    const { units, buildings, floors, blocks, entrances } = fullRegistry;
    const bMap = Object.fromEntries(buildings.map(b => [b.id, b]));
    const blMap = Object.fromEntries(blocks.map(b => [b.id, b]));
    const fMap = Object.fromEntries(floors.map(f => [f.id, f]));
    const eMap = Object.fromEntries(entrances.map(e => [e.id, e]));

    let allCommercial = units.map(u => {
      const floor = fMap[u.floorId];
      const block = floor ? blMap[floor.blockId] : null;
      const building = block ? bMap[block.buildingId] : null;
      const isResidentialUnit = RESIDENTIAL_UNIT_TYPES.has(u.type);
      const isCommercial = !isResidentialUnit;

      return {
        ...u,
        isCommercial,
        floorLabel: floor?.label || '-',
        floorIndex: floor?.index || 0,
        blockId: floor?.blockId,
        blockLabel: block?.tabLabel || block?.label || '-',
        buildingId: building?.id,
        buildingCode: building?.building_code || building?.buildingCode,
        houseNumber: building?.houseNumber || '-',
        entranceId: u.entranceId,
        entranceNumber: eMap[u.entranceId]?.number,
        isExplicationFilled: Array.isArray(u.explication) && u.explication.length > 0,
        livingArea: u.livingArea || 0,
        unitCode: u.unitCode, 
      };
    }).filter(u => u.isCommercial && (!selectedBuildingId || u.buildingId === selectedBuildingId) && (!activeBlockId || u.blockId === activeBlockId));

    const filteredList = allCommercial.filter(item => {
        if (!searchTerm) return true;
        return String(item.number || '').toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));

    // Matrix Data Preparation
    let matrixResult = null;
    let bottomFloorId = null;
    let firstEntranceId = null;

    if (activeBlockId) {
        const blockFloors = floors.filter(f => f.blockId === activeBlockId).sort((a, b) => (Number(b.index)||0) - (Number(a.index)||0));
        const blockEntrances = entrances.filter(e => e.blockId === activeBlockId).sort((a, b) => Number(a.number) - Number(b.number));
        
        const hasMatrixStructure = blockFloors.length > 0 && blockEntrances.length > 0;

        if (hasMatrixStructure) {
            const unitsByCell = {};
            const floorsWithComm = new Set();
            
            allCommercial.forEach(u => {
                if (!u.floorId || !u.entranceId) return;
                const key = `${activeBlockId}_${u.floorId}_${u.entranceId}`;
                if (!unitsByCell[key]) unitsByCell[key] = [];
                unitsByCell[key].push(u);
                floorsWithComm.add(u.floorId);
            });

            const relevantFloors = blockFloors.filter(f => {
                if (floorsWithComm.has(f.id)) return true;
                const hasPlan = blockEntrances.some(e => {
                    const key = `${f.id}_${e.number}`; 
                    const cell = matrixMap[key];
                    const planned = (parseInt(cell?.offices || 0) + parseInt(cell?.retail || 0));
                    return planned > 0;
                });
                if (hasPlan) return true;
                return false;
            });

            let floorsToShow = relevantFloors;
            const entranceStats = {};
            blockEntrances.forEach(e => {
                let total = 0, filled = 0;
                floorsToShow.forEach(f => {
                    const units = unitsByCell[`${activeBlockId}_${f.id}_${e.id}`] || [];
                    total += units.length;
                    filled += units.filter(u => u.isExplicationFilled).length;
                });
                entranceStats[e.id] = { total, filled };
            });

            if (floorsToShow.length > 0) bottomFloorId = floorsToShow[floorsToShow.length - 1].id;
            if (blockEntrances.length > 0) firstEntranceId = blockEntrances[0].id;

            matrixResult = { floors: floorsToShow, entrances: blockEntrances, unitsByCell, entranceStats, bottomFloorId, firstEntranceId };
        }
    }

    return {
      listData: filteredList,
      matrixData: matrixResult,
      commercialUnits: allCommercial,
      stats: { count: allCommercial.length, area: allCommercial.reduce((s, i) => s + (parseFloat(i.area)||0), 0) }
    };
  }, [fullRegistry, searchTerm, selectedBuildingId, activeBlockId, matrixMap]);

  // --- HANDLERS ---

  const clearSelection = () => setSelectedUnitId(null);

  const toggleUnit = (unitId) => {
    setSelectedUnitId(prev => prev === unitId ? null : unitId);
  };

  const handleUnitClick = (unit, floorId, entranceId, indexInCell, event) => {
      if (event) event.stopPropagation();
      toggleUnit(unit.id);
  };

  const handleSaveUnit = async (originalUnit, changes, invalidate = true) => {
    try {
      const payload = {
        ...originalUnit, ...changes,
        explication: changes.explication || originalUnit.explication
      };
      payload.id = originalUnit.id;
      
      await ApiService.upsertUnit(payload);
      if (invalidate) await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
      return true;
    } catch (error) {
      console.error(error);
      if (invalidate) toast.error('Ошибка: ' + error.message);
      return false;
    }
  };

  const applySingle = async payload => {
    setIsSaving(true);
    const success = await handleSaveUnit(payload, payload, true);
    setIsSaving(false);
    if (success) { toast.success('Сохранено'); }
  };

  const resetExplication = async units => {
    setIsSaving(true);
    try {
        await Promise.all(units.map(u => handleSaveUnit(u, { ...u, explication: [], area: 0, livingArea: 0, usefulArea: 0, rooms: 0 }, false)));
        await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
        toast.success('Сброшено');
    } finally { setIsSaving(false); }
  };

  // [NEW] AUTO FILL LOGIC FOR TESTING
  const handleAutoFillAll = async () => {
    if (isReadOnly || isSaving) return;
    if (commercialUnits.length === 0) {
        toast.info("Нет офисов для заполнения");
        return;
    }
    if (roomTypes.length === 0) {
        toast.error("Справочник типов помещений пуст");
        return;
    }

    if (!window.confirm(`Вы точно хотите автоматически заполнить ${commercialUnits.length} офисов случайными данными? Текущие данные будут перезаписаны.`)) {
        return;
    }

    setIsSaving(true);
    try {
        const payloadList = commercialUnits.map(unit => {
            // Генерация случайных комнат
            const roomsCount = Math.floor(Math.random() * 5) + 1; // 1 to 5 rooms
            const newRooms = [];
            let totalArea = 0;
            let mainArea = 0;
            let auxArea = 0;

            for (let i = 0; i < roomsCount; i++) {
                const randomType = roomTypes[Math.floor(Math.random() * roomTypes.length)];
                const area = parseFloat((Math.random() * 15 + 5).toFixed(2)); // 5 to 20
                const height = parseFloat((Math.random() * 1 + 3).toFixed(2)); // 3 to 4
                
                newRooms.push({
                    id: crypto.randomUUID(),
                    type: randomType.id,
                    area,
                    height,
                    level: 1,
                    label: randomType.label,
                    isMezzanine: false,
                });

                totalArea += area * (randomType.k || 1);
                if (randomType.category === 'main' || randomType.category === 'living') {
                    mainArea += area;
                } else {
                    auxArea += area;
                }
            }

            return {
                ...unit,
                explication: newRooms,
                area: totalArea.toFixed(2),
                livingArea: mainArea.toFixed(2),
                usefulArea: (mainArea + auxArea).toFixed(2),
                rooms: roomsCount,
                hasMezzanine: false,
                mezzanineType: null,
            };
        });

        // Сохраняем параллельно (для dev-режима это ок)
        await Promise.all(payloadList.map(p => handleSaveUnit(p, p, false)));
        await queryClient.invalidateQueries({ queryKey: ['project-registry', projectId] });
        
        toast.success(`Успешно заполнено ${commercialUnits.length} офисов`);
        clearSelection();

    } catch (e) {
        console.error(e);
        toast.error("Ошибка автозаполнения");
    } finally {
        setIsSaving(false);
    }
  };

  const activeUnit = useMemo(() => commercialUnits.find(u => u.id === selectedUnitId) || null, [commercialUnits, selectedUnitId]);

  if (loadingRegistry) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;
  if (!selectedBuildingId) return <BuildingSelector stepId="registry_commercial" onSelect={setInternalSelectedId} />;
  if (!building) return <div className="p-12 text-center text-slate-500">Загрузка данных...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 overflow-hidden pb-4">
      <BlockingLoader isOpen={isSaving} message="Сохранение..." />
      
      <div className="flex-none space-y-4 pb-4">
         <ConfigHeader building={building} isParking={typeInfo.isParking} isInfrastructure={typeInfo.isInfrastructure} isUnderground={typeInfo.isUnderground} onBack={() => onBack ? onBack() : setInternalSelectedId(null)} isSticky={false} showSaveButton={false} />
         
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl shadow-inner border border-slate-700 custom-scrollbar overflow-x-auto max-w-[60vw]">
                {(building.blocks || []).map(b => (
                  <DarkTabButton key={b.id} active={activeBlockId === b.id} onClick={() => { setActiveBlockId(b.id); clearSelection(); }} icon={getBlockIcon(b.type)}>
                    {formatBlockSwitcherLabel({ building, block: b, buildingDetails })} 
                  </DarkTabButton>
                ))}
             </div>
             <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></div> Готово</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded"></div> Не заполнен</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600 rounded"></div> Выбрано</div>
             </div>
         </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* STATS & SEARCH */}
            {!matrixData && (
                <div className="flex-none flex gap-4 mb-4">
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm"><div className="text-[10px] text-slate-500 font-bold uppercase">Всего</div><div className="text-xl font-black text-slate-800">{stats?.count}</div></div>
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm"><div className="text-[10px] text-slate-500 font-bold uppercase">Площадь</div><div className="text-xl font-black text-emerald-600">{stats?.area?.toFixed(1)}</div></div>
                    
                    <div className="flex flex-1 gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <DebouncedInput value={searchTerm} onChange={setSearchTerm} placeholder="Поиск..." className="w-full pl-9 bg-white border border-slate-200 rounded-xl h-full" />
                        </div>
                        
                        {/* [NEW] Auto Fill Button */}
                        {!isReadOnly && (
                            <Button 
                                onClick={handleAutoFillAll} 
                                className="bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200 shadow-lg"
                                title="Автозаполнение (DEV)"
                            >
                                <Wand2 size={18} />
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <Card className="flex-1 h-full border border-slate-300 shadow-md bg-white p-0 relative flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                    {matrixData ? (
                        <table className="border-collapse w-max min-w-full">
                            <thead className="sticky top-0 z-30 bg-slate-100 backdrop-blur-sm shadow-sm border-b-2 border-slate-300">
                                <tr>
                                    <th className="p-2 sticky left-0 z-40 bg-slate-100 border-r-2 border-slate-300 w-20 text-center text-[10px] font-black text-slate-500 uppercase">
                                        <div className="flex flex-col items-center gap-1"><LayoutTemplate size={16} className="opacity-50"/>Этаж</div>
                                    </th>
                                    {matrixData.entrances.map(e => {
                                        const stat = matrixData.entranceStats[e.id];
                                        const progress = stat.total > 0 ? (stat.filled / stat.total) * 100 : 0;
                                        const isComplete = stat.total > 0 && stat.filled === stat.total;
                                        return (
                                            <th key={e.id} className="p-2 border-r-2 border-slate-300 min-w-[200px] align-bottom">
                                                <div className="flex flex-col gap-2 pb-1 h-full justify-end">
                                                    <div className="relative flex items-center justify-center px-2 py-1">
                                                        <span className="font-black text-slate-700 text-sm uppercase text-center tracking-wide">Подъезд {e.number}</span>
                                                        {isComplete && <div className="absolute right-2 top-1/2 -translate-y-1/2"><CheckCircle2 size={18} className="text-emerald-600"/></div>}
                                                    </div>
                                                    <div className="flex items-center gap-2 px-1">
                                                        <div className="flex-1 bg-slate-200/80 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                                            <div className={`h-full transition-all duration-500 ${isComplete?'bg-emerald-500':'bg-blue-500'}`} style={{width:`${progress}%`}}/>
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-500 whitespace-nowrap tabular-nums">
                                                            <span className={isComplete?'text-emerald-600':'text-slate-700'}>{stat.filled}</span>
                                                            <span className="opacity-40">/</span>
                                                            <span>{stat.total}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </th>
                                        )
                                    })}
                                    
                                    {/* [NEW] AUTO FILL BUTTON IN MATRIX HEADER */}
                                    {!isReadOnly && (
                                        <th className="p-2 w-10 align-bottom pb-3 pl-0">
                                            <button 
                                                onClick={handleAutoFillAll} 
                                                className="p-2 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 hover:scale-110 transition-all border border-purple-200 shadow-sm"
                                                title="Автозаполнение всех офисов (DEV)"
                                            >
                                                <Wand2 size={16} />
                                            </button>
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {matrixData.floors.map(f => (
                                    <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 px-3 py-2 text-right font-bold text-slate-600 shadow-sm">{f.label || f.index}</td>
                                        {matrixData.entrances.map(e => {
                                            const cellUnits = matrixData.unitsByCell[`${activeBlockId}_${f.id}_${e.id}`] || [];
                                            return (
                                                <td key={e.id} className="p-2 border-r-2 border-slate-300 align-top">
                                                    <div className="flex flex-nowrap gap-1.5 justify-start">
                                                        {cellUnits.length === 0 ? <span className="text-xs text-slate-300 w-full text-center block opacity-30">—</span> : cellUnits.map((u, i) => (
                                                            <button key={u.id} onClick={(ev) => handleUnitClick(u, f.id, e.id, i, ev)} className={`h-7 px-2 rounded-md text-xs font-bold border transition-all min-w-[38px] flex-shrink-0 truncate ${selectedUnitId === u.id ? 'bg-blue-600 text-white shadow-md z-20' : u.isExplicationFilled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>{u.number}</button>
                                                        ))}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                        {!isReadOnly && <td className="p-0"></td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-600 border-b border-slate-300 text-[10px] uppercase font-bold sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="p-3 w-12 border-r border-slate-200">#</th>
                                    <th className="p-3 w-32 border-r border-slate-200">Номер</th>
                                    <th className="p-3 border-r border-slate-200">Тип</th>
                                    <th className="p-3 text-right text-emerald-700 border-r border-slate-200">Площадь</th>
                                    <th className="p-3 text-center">Статус</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {listData.length ? listData.map((item, i) => {
                                    const typeConf = getTypeConfig(item.type);
                                    const isSel = selectedUnitId === item.id;
                                    return (
                                        <tr key={item.id} onClick={() => toggleUnit(item.id)} className={`cursor-pointer transition-colors ${isSel ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50'}`}>
                                            <td className="p-3 text-center text-xs text-slate-400">{i+1}</td>
                                            <td className="p-3 text-center font-bold text-slate-800">{item.number}</td>
                                            <td className="p-3"><span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border ${typeConf.color}`}><typeConf.icon size={12}/>{typeConf.label}</span></td>
                                            <td className="p-3 text-right font-mono font-bold text-slate-700">{parseFloat(item.area).toFixed(2)}</td>
                                            <td className="p-3 text-center">{item.isExplicationFilled ? <CheckCircle2 size={16} className="inline text-emerald-500"/> : <span className="text-[10px] text-slate-300">Пусто</span>}</td>
                                        </tr>
                                    )
                                }) : <tr><td colSpan={5}><EmptyState icon={Briefcase} title="Нет объектов" description="Список пуст." compact className="py-8"/></td></tr>}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>

        <ExplicationPanel
          activeUnit={activeUnit}
          roomTypes={roomTypes}
          onApplySingle={applySingle}
          onResetExplication={resetExplication}
          onClearSelection={clearSelection}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
};

export default React.memo(CommercialRegistry);