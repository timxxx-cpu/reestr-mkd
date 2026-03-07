import React, { useState, useMemo, useEffect } from 'react';
import {
  Wand2,
  Building2,
  Car,
  Box,
  Store,
  LayoutGrid,
  Layers,
  Save,
  Eraser,
  RefreshCw,
  AlertTriangle,
  Briefcase,
  Package,
  ArrowUp,
  ArrowDown,
  PlusCircle
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useDirectFloors } from '@hooks/api/useDirectFloors';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix';
import { useDirectUnits } from '@hooks/api/useDirectUnits';
import { useBuildingType } from '@hooks/useBuildingType';
import { Card, useReadOnly, Modal, Button, Label, Select, BlockingLoader, DebouncedInput } from '@components/ui/UIKit';
import { ApiService } from '@lib/api-service';
import { AuthService } from '@lib/auth-service';
import ConfigHeader from '@/features/steps/configurator/ConfigHeader';
import { formatBlockSwitcherLabel } from '@lib/building-details';
import { OUTSIDE_ENTRANCE_KEY, useMatrixData } from '@hooks/useMatrixData';
import { useToast } from '@context/ToastContext';

// Компактные стили и мини-лейблы
const TYPE_CONFIG = {
  flat: { 
    base: 'bg-white border-slate-200 text-slate-700 font-bold', 
    hover: 'hover:border-blue-400 hover:shadow-sm hover:z-10',
    icon: null 
  },
  office: { 
    base: 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold', 
    hover: 'hover:border-emerald-400 hover:shadow-sm hover:z-10',
    icon: <Briefcase size={8} className="text-emerald-600" />,
    badge: 'ОФ'
  },
  duplex_up: { 
    base: 'bg-purple-50 border-purple-200 text-purple-700 font-bold', 
    hover: 'hover:border-purple-400 hover:shadow-sm hover:z-10',
    icon: <ArrowUp size={8} className="text-purple-600" />,
    badge: 'Д-ВВ'
  },
  duplex_down: { 
    base: 'bg-orange-50 border-orange-200 text-orange-700 font-bold', 
    hover: 'hover:border-orange-400 hover:shadow-sm hover:z-10',
    icon: <ArrowDown size={8} className="text-orange-600" />,
    badge: 'Д-ВН'
  },
  pantry: { 
    base: 'bg-slate-100 border-slate-200 text-slate-500 font-medium', 
    hover: 'hover:border-slate-400 hover:shadow-sm hover:z-10',
    icon: <Package size={8} className="text-slate-500" />,
    badge: 'КЛ'
  },
};

const DarkTabButton = ({ active, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`
            px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${
              active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }
        `}
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

const isBasementFloor = floor =>
  !!floor &&
  (floor.type === 'basement' || floor.type === 'tsokol' || !!floor.isBasement || !!floor.flags?.isBasement);

const isNonResidentialBlock = block =>
  !!block && (block.type === 'non_residential' || block.type === 'Н' || block.originalType === 'Н');

const isBasementBlock = block =>
  !!block &&
  (!!block.isBasementBlock ||
    block.type === 'basement' ||
    block.type === 'ПД' ||
    block.type === 'BAS' ||
    block.originalType === 'basement' ||
    block.originalType === 'BAS');

const toPositiveInt = value => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getBlockIcon = type => {
  if (type === 'residential') return Building2;
  if (type === 'parking') return Car;
  if (type === 'infrastructure') return Box;
  if (type === 'non_residential') return Store;
  return LayoutGrid;
};

export default function FlatMatrixEditor({ buildingId, onBack }) {
  const { projectId, buildingDetails, saveStepBuildingStatuses, saveProjectImmediate, setHasUnsavedChanges } = useProject();
  const isReadOnly = useReadOnly();
  const toast = useToast();
  const currentUser = AuthService.getCurrentUser?.() || null;
  const actor = {
    userName: currentUser?.displayName || currentUser?.email || 'unknown',
    userRole: currentUser?.role || 'technician',
  };

  const { buildings } = useDirectBuildings(projectId);
  const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);
  const residentialBlocks = useMemo(
    () => (building?.blocks || []).filter(block => block.type === 'residential'),
    [building]
  );
  const typeInfo = useBuildingType(building);
  const { isParking, isInfrastructure, isUnderground } = typeInfo;

  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const currentBlock = useMemo(() => residentialBlocks[activeBlockIndex], [residentialBlocks, activeBlockIndex]);

  useEffect(() => {
    if (activeBlockIndex < residentialBlocks.length) return;
    setActiveBlockIndex(0);
  }, [activeBlockIndex, residentialBlocks.length]);

  const { floors: rawFloors } = useDirectFloors(currentBlock?.id);
  const [linkedExternalFloors, setLinkedExternalFloors] = useState([]);
  
  useEffect(() => {
    let cancelled = false;
    const loadLinked = async () => {
      if (!building?.blocks?.length || !currentBlock?.id) {
        if (!cancelled) setLinkedExternalFloors([]);
        return;
      }

      const candidateExternalBlocks = building.blocks.filter(
        block => isNonResidentialBlock(block) || isBasementBlock(block)
      );

      const blocksToFetch = candidateExternalBlocks;
      if (!blocksToFetch.length) {
        if (!cancelled) setLinkedExternalFloors([]);
        return;
      }

      try {
        const responses = await Promise.all(blocksToFetch.map(block => ApiService.getFloors(block.id)));
        const externalFloors = responses
          .flat()
          .filter(
            floor =>
              isLinkedStylobateFloor(floor) ||
              isBasementFloor(floor) ||
              (Number(floor?.index) || 0) < 0
          );

        if (!cancelled) setLinkedExternalFloors(externalFloors);
      } catch (e) {
        console.error(e);
        if (!cancelled) setLinkedExternalFloors([]);
      }
    };
    loadLinked();
    return () => { cancelled = true; };
  }, [building, buildingDetails, currentBlock]);

  const linkedExternalFloorIds = useMemo(
    () => linkedExternalFloors.map(f => f.id).filter(Boolean),
    [linkedExternalFloors]
  );

  const { entrances, matrixMap } = useDirectMatrix(currentBlock?.id);
  const { units, upsertUnit, batchUpsertUnits } = useDirectUnits(currentBlock?.id, linkedExternalFloorIds);

  const hasOutsideByMatrix = useMemo(
    () =>
      Object.entries(matrixMap || {}).some(
        ([key, value]) =>
          key.endsWith('_0') &&
          (toPositiveInt(value?.apts) > 0 || toPositiveInt(value?.units) > 0)
      ),
    [matrixMap]
  );

  const hasOutsideByUnits = useMemo(
    () => (units || []).some(unit => !unit?.entranceId),
    [units]
  );

  const entranceColumns = useMemo(() => {
    const columns = (entrances || []).map(entrance => ({
      id: entrance.id,
      number: entrance.number,
      matrixNumber: entrance.number,
      unitEntranceId: entrance.id,
      isOutside: false,
    }));

    if (hasOutsideByMatrix || hasOutsideByUnits) {
      columns.push({
        id: OUTSIDE_ENTRANCE_KEY,
        number: 0,
        matrixNumber: 0,
        unitEntranceId: null,
        isOutside: true,
      });
    }

    return columns;
  }, [entrances, hasOutsideByMatrix, hasOutsideByUnits]);

  const allCandidateFloors = useMemo(() => {
    const localFloors = (rawFloors || []).filter(floor => !(floor.isStylobate || floor.flags?.isStylobate));
    const merged = [...localFloors, ...linkedExternalFloors];
    return Array.from(new Map(merged.map(floor => [floor.id, floor])).values());
  }, [rawFloors, linkedExternalFloors]);

  const displayFloors = useMemo(() => {
    return allCandidateFloors
      .filter(floor => {
        const hasPlan = entranceColumns.some(entrance => {
          const matrixKey = `${floor.id}_${entrance.matrixNumber}`;
          const cell = matrixMap[matrixKey] || {};
          return toPositiveInt(cell.apts) > 0 || toPositiveInt(cell.units) > 0;
        });
        const hasExistingUnits = (units || []).some(unit => unit.floorId === floor.id);
        return !!floor.isDuplex || hasPlan || hasExistingUnits;
      })
      .sort((a, b) => (Number(b.index) || 0) - (Number(a.index) || 0));
  }, [allCandidateFloors, entranceColumns, matrixMap, units]);

  const { gridMap, generateInitialUnits, prepareResetPayload } = useMatrixData(
    units,
    displayFloors,
    entranceColumns,
    matrixMap
  );
  const floorBlockIdMap = useMemo(() => {
    const map = new Map();
    allCandidateFloors.forEach(floor => {
      map.set(floor.id, floor.blockId || currentBlock?.id || null);
    });
    return map;
  }, [allCandidateFloors, currentBlock?.id]);

  const [editingUnit, setEditingUnit] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showFillModal, setShowFillModal] = useState(false); // Модалка заполнения

  const [confirmDuplexFloor, setConfirmDuplexFloor] = useState(null); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [startNum, setStartNum] = useState(1);
  
  // Автогенерация удалена

  // Ручная генерация
  const handleManualFill = async () => {
    setShowFillModal(false);
    
    const hasPlannedUnits = Object.values(matrixMap).some(
      value => toPositiveInt(value?.apts) > 0 || toPositiveInt(value?.units) > 0
    );
    if (!hasPlannedUnits) {
       toast.error('Матрица пуста. Сначала укажите количество квартир/офисов на этажах.');
       return;
    }

    setIsGenerating(true);

    try {
      const initialUnits = generateInitialUnits(startNum);
      
      if (initialUnits.length === 0) {
         toast.info('Нет помещений для создания');
         return;
      }

      await batchUpsertUnits(initialUnits);
      toast.success(`Успешно создано ${initialUnits.length} помещений`);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при создании помещений');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditClick = (unit, floor) => {
    if (!floor?.isDuplex) {
        setEditingUnit({ ...unit, duplexOptions: { up: false, down: false } });
        return;
    }

    const currentIndex = Number(floor.index) || 0;
    const lowerFloor = rawFloors.find(f => (Number(f.index) || 0) === currentIndex - 1);

    const canGoUp = true; 

    const isFirstFloor = currentIndex === 1;
    const hasBasementBelow = lowerFloor && ['basement', 'tsokol'].includes(lowerFloor.type);
    
    const canGoDown = isFirstFloor && hasBasementBelow;

    setEditingUnit({ 
        ...unit, 
        duplexOptions: {
            up: canGoUp,
            down: canGoDown
        }
    }); 
  };

  const handleSetFloorDuplex = (floor) => {
    if (isReadOnly) return;
    setConfirmDuplexFloor(floor);
  };

  const performFloorDuplexUpdate = async () => {
    if (!confirmDuplexFloor) return;
    
    const floor = confirmDuplexFloor;
    setConfirmDuplexFloor(null); 
    setIsGenerating(true); 

    const targetUnits = units.filter(u => u.floorId === floor.id && u.type !== 'duplex_up');
    
    if (targetUnits.length === 0) {
        toast.info('Нет квартир для обновления');
        setIsGenerating(false);
        return;
    }

    const updates = targetUnits.map(u => ({
        id: u.id,
        floorId: u.floorId,
        entranceId: u.entranceId,
        num: u.num,
        type: 'duplex_up'
    }));

    try {
        await batchUpsertUnits(updates);
        toast.success(`Обновлено ${updates.length} квартир`);
    } catch (e) {
        console.error('Batch update error:', e);
        toast.error('Ошибка массового обновления');
    } finally {
        setIsGenerating(false);
    }
  };

  const saveEditedUnit = async () => {
    if (!editingUnit) return;
    const targetNum = String(editingUnit.num).trim().toLowerCase();
    
    if (!targetNum) {
        toast.error('Номер помещения не может быть пустым');
        return;
    }

    const targetBlockId = floorBlockIdMap.get(editingUnit.floorId) || currentBlock?.id || null;
    const duplicate = units.find(u => {
        if (!u || u.id === editingUnit.id) return false;
        if (String(u.num).trim().toLowerCase() !== targetNum) return false;
        const candidateBlockId = floorBlockIdMap.get(u.floorId) || currentBlock?.id || null;
        return candidateBlockId === targetBlockId;
    });

    if (duplicate) {
        toast.error(`Номер "${editingUnit.num}" уже занят!`);
        return;
    }

    const { duplexOptions, ...payload } = editingUnit;
    try {
        await upsertUnit(payload);
        setEditingUnit(null);
        toast.success('Обновлено');
    } catch (e) {
        toast.error('Не удалось сохранить');
    }
  };

  const handleResetAndRenumber = async () => {
    setShowResetModal(false);
    setIsGenerating(true);
    try {
      const payload = prepareResetPayload(startNum);
      if (payload.length > 0) {
        await batchUpsertUnits(payload);
        toast.success(`Обновлено ${payload.length} квартир`);
      } else {
        toast.info('Нет данных');
      }
    } catch (e) {
      console.error(e);
      toast.error('Ошибка при сбросе данных');
    } finally {
      setIsGenerating(false);
    }
  };


  const requestReconcilePreview = async () => {
    if (!currentBlock?.id) return null;
    setIsPreviewLoading(true);
    try {
      return await ApiService.previewReconcileByBlock(currentBlock.id);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSaveStep = async () => {
      setIsSaving(true);
      try {
        await saveProjectImmediate({ shouldRefetch: false });

        const preview = await requestReconcilePreview();
        const previewUnits = preview?.units?.toRemove || 0;
        if (previewUnits > 0) {
          const confirmed = confirm(`Будут удалены лишние помещения по плану: ${previewUnits}. Продолжить?`);
          if (!confirmed) {
            setIsSaving(false);
            return;
          }
        }

        const reconcile = await ApiService.reconcileUnitsForBlock(currentBlock.id, actor);
        await saveStepBuildingStatuses({ stepId: 'apartments', buildingId: building.id });
        setHasUnsavedChanges(false);

        if (reconcile?.removed > 0) {
          toast.warning(`Синхронизация: удалено лишних помещений — ${reconcile.removed}`);
        } else {
          toast.success('Конфигурация квартир сохранена');
        }
        onBack();
      } catch (e) {
        console.error(e);
        toast.error('Ошибка при сохранении статуса');
      } finally {
        setIsSaving(false);
      }
  };

  const colWidths = useMemo(() => {
    const widths = {};
    entranceColumns.forEach(e => {
      let maxCount = 0;
      displayFloors.forEach(f => {
        const matrixKey = `${f.id}_${e.matrixNumber}`;
        const count = toPositiveInt(matrixMap[matrixKey]?.apts) + toPositiveInt(matrixMap[matrixKey]?.units);
        if (count > maxCount) maxCount = count;
      });
      const CELL_WIDTH = 58; 
      const GAP = 4;
      const PADDING = 16;
      widths[e.id] = Math.max(80, maxCount * CELL_WIDTH + (maxCount - 1) * GAP + PADDING);
    });
    return widths;
  }, [entranceColumns, displayFloors, matrixMap]);

  const hasUnits = units.length > 0;

  if (!building) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;
  if (residentialBlocks.length === 0) return <div className="p-12 text-center text-slate-500">Нет жилых блоков</div>;
  if (!currentBlock) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 overflow-hidden pb-4">
      
      <BlockingLoader isOpen={isGenerating || isSaving} message={isSaving ? "Сохранение прогресса..." : "Обработка данных..."} />

      <ConfigHeader
        building={building}
        isParking={isParking}
        isInfrastructure={isInfrastructure}
        isUnderground={isUnderground}
        onBack={onBack}
        showSaveButton={true}
        onSave={handleSaveStep}
        saveDisabled={isReadOnly || isGenerating || isSaving || isPreviewLoading}
        saveLabel={isPreviewLoading ? 'Проверяем...' : isSaving ? 'Сохранение...' : 'Сохранить и выйти'}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl shadow-inner border border-slate-700 custom-scrollbar overflow-x-auto max-w-[50%]">
          {residentialBlocks.map((b, i) => (
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

        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Старт №:</span>
              <input
                disabled={isReadOnly || isGenerating}
                type="number"
                className={`w-12 bg-transparent font-bold text-sm text-slate-700 outline-none text-center ${isReadOnly || isGenerating ? 'opacity-50' : ''}`}
                value={startNum}
                onChange={e => setStartNum(parseInt(e.target.value) || 1)}
              />
           </div>

           {!hasUnits ? (
             <Button 
                onClick={() => setShowFillModal(true)}
                disabled={isReadOnly || isGenerating}
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-sm"
             >
                <PlusCircle size={16} className="mr-2" />
                Заполнить блок
             </Button>
           ) : (
             <Button 
                variant="destructive"
                onClick={() => setShowResetModal(true)}
                disabled={isReadOnly || isGenerating}
                className="h-10 px-4 shadow-red-100 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700"
             >
                <Eraser size={16} className="mr-2" />
                Сброс / Пересоздать
             </Button>
           )}
        </div>
      </div>

      <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col bg-white max-w-full flex-1 min-h-0">
        <div className="flex-1 overflow-auto relative custom-scrollbar">
          <table className="border-collapse w-max min-w-full">
            <thead className="sticky top-0 z-40 shadow-sm">
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-2 sticky left-0 z-50 bg-slate-200 border-r border-slate-300 w-16 text-center shadow-md text-[10px] font-black text-slate-600 uppercase">
                  Этаж
                </th>
                {entranceColumns.map(e => (
                  <th key={e.id} className="p-2 border-r border-slate-300/50 bg-slate-100 text-center" style={{ width: colWidths[e.id], minWidth: colWidths[e.id] }}>
                    <div className="flex flex-col gap-0.5 items-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Подъезд</span>
                      <div className="w-6 h-6 rounded bg-white border border-slate-300 flex items-center justify-center text-xs font-black text-slate-800 shadow-sm">{e.number}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayFloors.map((f) => {
                const isDuplex = f.isDuplex;
                return (
                  <tr key={f.id} className={`${isDuplex ? 'bg-purple-50/20' : 'bg-white'} hover:bg-slate-50/80 transition-colors`}>
                    <td className="p-2 font-bold text-xs sticky left-0 border-r border-slate-300/80 text-center z-30 bg-slate-100 text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group">
                      <div className="flex flex-col items-center justify-center h-full relative">
                        {f.label}
                        
                        {isDuplex && (
                          <div title="Дуплексный этаж" className="mt-0.5 text-purple-600">
                            {!isReadOnly ? (
                                <button 
                                    onClick={() => handleSetFloorDuplex(f)}
                                    className="p-1 hover:bg-purple-200 rounded transition-colors"
                                    title="Назначить всем квартирам на этаже тип 'Дуплекс (Вверх)'"
                                >
                                    <Layers size={14} />
                                </button>
                            ) : (
                                <Layers size={14} />
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {entranceColumns.map((e) => {
                      const cellUnits = gridMap[f.id]?.[e.id] || [];
                      const isEvenCol = e.number % 2 === 0;
                      const bgColor = e.isOutside ? 'bg-amber-50/30' : (isEvenCol ? 'bg-slate-50/30' : 'bg-white');

                      return (
                        <td key={e.id} className={`p-2 border-r border-slate-100 align-top ${bgColor}`} style={{ width: colWidths[e.id] }}>
                          <div className="flex flex-wrap gap-1 content-start justify-center">
                            {cellUnits.map((unit) => {
                              const conf = TYPE_CONFIG[unit.type] || TYPE_CONFIG.flat;
                              
                              return (
                                <button 
                                    key={unit.id}
                                    onClick={() => !isReadOnly && handleEditClick(unit, f)}
                                    className={`
                                        relative group flex items-center justify-center
                                        w-[54px] h-[34px] rounded border transition-all duration-200
                                        ${conf.base} ${!isReadOnly ? conf.hover : ''}
                                    `}
                                >
                                    {conf.badge && (
                                        <div className="absolute -top-1.5 -right-1.5 bg-white border border-current px-0.5 rounded-[3px] text-[7px] leading-none uppercase tracking-tight shadow-sm z-20">
                                            {conf.badge}
                                        </div>
                                    )}

                                    <span className="truncate w-full text-center px-0.5 text-sm font-bold tracking-tight">
                                        {unit.num || '-'}
                                    </span>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal 
        isOpen={!!editingUnit} 
        onClose={() => setEditingUnit(null)} 
        title={`Квартира ${editingUnit?.num || ''}`}
        maxWidth="max-w-xs"
      >
         <div className="space-y-4">
            <div className="space-y-1.5">
                <Label>Номер помещения</Label>
                <DebouncedInput 
                    value={editingUnit?.num} 
                    onChange={v => setEditingUnit(prev => ({...prev, num: v}))}
                    className="font-bold text-lg"
                    autoFocus
                />
            </div>

            {(editingUnit?.duplexOptions?.up || editingUnit?.duplexOptions?.down || ['duplex_up', 'duplex_down'].includes(editingUnit?.type)) && (
                <div className="space-y-1.5">
                    <Label>Конфигурация</Label>
                    <Select 
                        value={['duplex_up', 'duplex_down'].includes(editingUnit?.type) ? editingUnit?.type : 'flat'}
                        onChange={e => setEditingUnit(prev => ({...prev, type: e.target.value}))}
                    >
                        <option value="flat">Стандартная квартира</option>
                        
                        {editingUnit?.duplexOptions?.up && (
                            <option value="duplex_up">Дуплекс (Вверх)</option>
                        )}
                        {editingUnit?.duplexOptions?.down && (
                            <option value="duplex_down">Дуплекс (Вниз)</option>
                        )}
                        
                        {!editingUnit?.duplexOptions?.up && editingUnit?.type === 'duplex_up' && (
                             <option value="duplex_up" disabled>Дуплекс (Вверх) - Недоступно</option>
                        )}
                        {!editingUnit?.duplexOptions?.down && editingUnit?.type === 'duplex_down' && (
                             <option value="duplex_down" disabled>Дуплекс (Вниз) - Недоступно</option>
                        )}
                    </Select>
                </div>
            )}

            <div className="pt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEditingUnit(null)}>Отмена</Button>
                <Button onClick={saveEditedUnit}>Сохранить</Button>
            </div>
         </div>
      </Modal>

      {/* NEW: Модальное окно заполнения */}
      <Modal
        isOpen={showFillModal}
        onClose={() => setShowFillModal(false)}
        title="Заполнение блока"
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
           <div className="p-4 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-100 flex items-start gap-3">
              <PlusCircle className="shrink-0 text-emerald-600" size={24} />
              <div className="text-sm">
                 <p className="font-bold mb-1">Создание квартир</p>
                 <p className="opacity-90 leading-relaxed">
                    Система создаст квартиры и офисы на основе матрицы этажей.
                 </p>
                 <div className="mt-2 bg-white/60 p-2 rounded border border-emerald-100/50">
                    <p className="text-xs font-bold text-emerald-700 uppercase">Нумерация начнется с:</p>
                    <p className="text-xl font-black text-emerald-800">{startNum}</p>
                 </div>
              </div>
           </div>
           
           <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowFillModal(false)}>Отмена</Button>
              <Button 
                onClick={handleManualFill}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Создать и пронумеровать
              </Button>
           </div>
        </div>
      </Modal>

      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Сброс и перенумерация"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
           <div className="p-4 bg-red-50 text-red-900 rounded-xl border border-red-100 flex items-start gap-3">
              <AlertTriangle className="shrink-0 text-red-600" size={24} />
              <div className="text-sm">
                 <p className="font-bold mb-1">Вы уверены?</p>
                 <p className="opacity-90">
                    Все квартиры будут сброшены в "Стандартные" и перенумерованы начиная с {startNum}.
                 </p>
                 <p className="mt-2 font-bold text-red-700">
                    Настройки дуплексов и офисов будут удалены.
                 </p>
              </div>
           </div>
           
           <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowResetModal(false)}>Отмена</Button>
              <Button 
                variant="destructive" 
                onClick={handleResetAndRenumber}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw size={16} className="mr-2" /> Подтвердить
              </Button>
           </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!confirmDuplexFloor}
        onClose={() => setConfirmDuplexFloor(null)}
        title={`Дуплексы на этаже ${confirmDuplexFloor?.label || ''}`}
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
           <div className="p-4 bg-purple-50 text-purple-900 rounded-xl border border-purple-100 flex items-start gap-3">
              <Layers className="shrink-0 text-purple-600" size={24} />
              <div className="text-sm">
                 <p className="font-bold mb-1">Массовое обновление</p>
                 <p className="opacity-90 leading-relaxed">
                    Вы хотите присвоить всем квартирам на этом этаже тип <strong>«Дуплекс (Вверх)»</strong>?
                 </p>
              </div>
           </div>
           
           <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirmDuplexFloor(null)}>Отмена</Button>
              <Button 
                onClick={performFloorDuplexUpdate}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Layers size={16} className="mr-2" /> Применить
              </Button>
           </div>
        </div>
      </Modal>

    </div>
  );
}



