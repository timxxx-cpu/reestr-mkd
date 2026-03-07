import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  MousePointer2,
  CheckCircle2,
  RotateCcw,
  ArrowDown,
  Check,
  X,
  Copy,
  Eraser
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useProject } from '@context/ProjectContext';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useDirectFloors } from '@hooks/api/useDirectFloors';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix';
import { useDirectCommonAreas } from '@hooks/api/useDirectCommonAreas';
import { useBuildingType } from '@hooks/useBuildingType';
import { Card, DebouncedInput, useReadOnly, Select, Button, BlockingLoader, Modal } from '@components/ui/UIKit';
import ConfigHeader from '@/features/steps/configurator/ConfigHeader';
import { useCatalog } from '@hooks/useCatalogs';
import { MopItemSchema } from '@lib/schemas';
import { ApiService } from '@lib/api-service';
import { AuthService } from '@lib/auth-service';
import { formatBlockSwitcherLabel } from '@lib/building-details';
import { useToast } from '@context/ToastContext';
import {
    BLOCK_FILL_STATUS,
    validateStepCompletion,
    getStepBlocksForStatus,
    buildScopedContextForBlock,
  } from '@lib/step-validators';

// --- UI COMPONENTS ---

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

// --- LOGIC HELPERS ---

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

export default function MopEditor({ buildingId, onBack }) {
  const toast = useToast();
  const currentUser = AuthService.getCurrentUser?.() || null;
  const actor = {
    userName: currentUser?.displayName || currentUser?.email || 'unknown',
    userRole: currentUser?.role || 'technician',
  };
  const queryClient = useQueryClient();
  const { 
      projectId, 
      buildingDetails, 
      saveStepBuildingStatuses, 
      saveProjectImmediate,
      setHasUnsavedChanges,
      composition,
      floorData,
      entrancesData,
      flatMatrix,
      mopData: contextMopData
  } = useProject();
  const isReadOnly = useReadOnly();

  // --- DATA LOADING ---
  const { buildings } = useDirectBuildings(projectId);
  const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);
  const typeInfo = useBuildingType(building);
  const { isUnderground, isParking, isInfrastructure } = typeInfo;

  const residentialBlocks = useMemo(() => {
    if (!building?.blocks?.length) return [];
    return building.blocks.filter(b => b.type === 'residential');
  }, [building]);

  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const currentBlock = useMemo(() => residentialBlocks[activeBlockIndex], [residentialBlocks, activeBlockIndex]);

  const { floors: rawFloors } = useDirectFloors(currentBlock?.id);
  const { entrances, matrixMap } = useDirectMatrix(currentBlock?.id);
  
  // Linked external floors (stylobate + basements)
  const [linkedExternalFloors, setLinkedExternalFloors] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loadLinkedExternalFloors = async () => {
      if (!building?.blocks?.length || !currentBlock?.id) {
        if (!cancelled) setLinkedExternalFloors([]);
        return;
      }

      const linkedStylobateBlocks = building.blocks.filter(block => {
        if (block.type !== 'non_residential') return false;
        const detailsKey = `${building.id}_${block.id}`;
        const details = buildingDetails?.[detailsKey] || {};
        return Array.isArray(details.parentBlocks) && details.parentBlocks.includes(currentBlock.id);
      });
      const linkedBasementBlocks = building.blocks.filter(block =>
        !!block.isBasementBlock && Array.isArray(block.linkedBlockIds) && block.linkedBlockIds.includes(currentBlock.id)
      );
      const blocksToFetch = [...linkedStylobateBlocks, ...linkedBasementBlocks];

      if (blocksToFetch.length === 0) {
        if (!cancelled) setLinkedExternalFloors([]);
        return;
      }

      try {
        const floorsByBlock = await Promise.all(
          blocksToFetch.map(block => ApiService.getFloors(block.id))
        );
        const externalFloors = floorsByBlock.flat().filter(floor =>
          isLinkedStylobateFloor(floor) || floor.type === 'basement' || floor.flags?.isBasement
        );
        if (!cancelled) setLinkedExternalFloors(externalFloors);
      } catch (e) {
        console.error('Failed to load linked external floors for mop', e);
        if (!cancelled) setLinkedExternalFloors([]);
      }
    };

    loadLinkedExternalFloors();
    return () => {
      cancelled = true;
    };
  }, [building, buildingDetails, currentBlock]);
  const linkedExternalFloorIds = useMemo(
    () => linkedExternalFloors.map(f => f.id).filter(Boolean),
    [linkedExternalFloors]
  );

  const mopFloorIds = useMemo(() => {
    const ids = new Set();
    (rawFloors || []).forEach(f => {
      if (!f?.id) return;
      if (f?.isStylobate || f?.flags?.isStylobate) return;
      ids.add(f.id);
    });
    linkedExternalFloorIds.forEach(id => {
      if (id) ids.add(id);
    });
    return Array.from(ids);
  }, [rawFloors, linkedExternalFloorIds]);

  const { mops, upsertMop, deleteMop, clearAllMops } = useDirectCommonAreas(currentBlock?.id, mopFloorIds);
  const { options: mopTypeOptions } = useCatalog('dict_mop_types');

  const mopLabelByCode = useMemo(() => {
    const map = {};
    mopTypeOptions.forEach(o => { if (o?.code) map[o.code] = o.label; });
    return map;
  }, [mopTypeOptions]);

  const floors = useMemo(() => {
    const residentialFloors = (rawFloors || []).filter(f => !(f?.isStylobate || f?.flags?.isStylobate));
    const map = new Map();
    [...residentialFloors, ...linkedExternalFloors].forEach(floor => {
      if (!floor?.id) return;
      map.set(floor.id, floor);
    });
    return Array.from(map.values()).sort((a, b) => (Number(b.index) || 0) - (Number(a.index) || 0));
  }, [rawFloors, linkedExternalFloors]);

  const hasBasements = useMemo(
    () => floors.some(f => f.type === 'basement' || f.flags?.isBasement),
    [floors]
  );

  const entranceIdByNumber = useMemo(() => {
    const map = {};
    entrances.forEach(e => {
      map[e.number] = e.id;
    });
    return map;
  }, [entrances]);

  const entranceNumberById = useMemo(() => {
    const map = {};
    entrances.forEach(e => {
      map[e.id] = e.number;
    });
    return map;
  }, [entrances]);

  const mopGrid = useMemo(() => {
    const grid = {};
    mops.forEach(m => {
      if (!grid[m.floorId]) grid[m.floorId] = {};
      const entranceNumber = m.entranceId ? entranceNumberById[m.entranceId] : 0;
      if (entranceNumber === undefined || entranceNumber === null) return;
      if (!grid[m.floorId][entranceNumber]) grid[m.floorId][entranceNumber] = [];
      grid[m.floorId][entranceNumber].push(m);
    });
    return grid;
  }, [mops, entranceNumberById]);
  // --- STATE ---
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [draftRows, setDraftRows] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    if (activeBlockIndex < residentialBlocks.length) return;
    setActiveBlockIndex(0);
  }, [activeBlockIndex, residentialBlocks.length]);

  useEffect(() => {
    // УМНОЕ ОБНОВЛЕНИЕ: не перезаписываем пустые массивы и сеты, если они уже пустые
    setSelection(prev => prev.size === 0 ? prev : new Set());
    setDraftRows(prev => prev.length === 0 ? prev : []);
  }, [activeBlockIndex]);

  // --- HELPER: GET TARGET QTY ---
  const getTargetQty = useCallback((floorId, entranceNumber) => {
      const matrixKey = `${floorId}_${entranceNumber}`;
      return parseInt(matrixMap[matrixKey]?.mopQty || 0, 10);
  }, [matrixMap]);

  // --- ACTIONS ---
  const handleResetAll = async () => {
      if (isReadOnly) return;
      if (!confirm('Вы уверены? Это действие удалит ВСЕ данные МОП для текущего блока без возможности восстановления.')) return;
      
      try {
          setIsSavingStatus(true);
          await clearAllMops();
          setHasUnsavedChanges(true);
          setSelection(new Set());
          setDraftRows([]);
      } catch (e) {
          console.error(e);
          toast.error('Ошибка при сбросе данных');
      } finally {
          setIsSavingStatus(false);
      }
  };

  // --- SELECTION LOGIC ---
  const validateSelectionQty = (currentSelection, newKeys) => {
      if (currentSelection.size === 0) return true;
      
      // Get target qty of existing selection
      const firstKey = Array.from(currentSelection)[0];
      const [firstFloorId, firstEntranceId] = firstKey.split('_');
      const requiredQty = getTargetQty(firstFloorId, firstEntranceId);

      // Check new keys
      const hasMismatch = newKeys.some(key => {
          const [fid, eid] = key.split('_');
          return getTargetQty(fid, eid) !== requiredQty;
      });

      return !hasMismatch;
  };

  const isCellSelectable = (floorId, entranceNumber) => {
      return getTargetQty(floorId, entranceNumber) > 0;
  };

  const toggleCell = (floorId, entranceNumber) => {
    if (!isCellSelectable(floorId, entranceNumber)) {
        toast.error('В этой ячейке не запланировано создание МОП');
        return;
    }

    const key = `${floorId}_${entranceNumber}`;
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
          next.delete(key);
      } else {
          // Check constraint
          if (prev.size > 0 && !validateSelectionQty(prev, [key])) {
              toast.error('Можно выбирать только ячейки с одинаковым плановым количеством МОП');
              return prev;
          }
          next.add(key);
      }
      return next;
    });
  };

  const selectFloor = floorId => {
    const floor = floors.find(f => f.id === floorId);
    const isBasement = floor?.type === 'basement' || floor?.flags?.isBasement;
    const entranceNumbers = isBasement && hasBasements
      ? [...entrances.map(e => e.number), 0]
      : entrances.map(e => e.number);

    const keys = entranceNumbers
      .map(entNum => `${floorId}_${entNum}`)
      .filter(k => {
        const [f, e] = k.split('_');
        return isCellSelectable(f, e);
      });

    if (keys.length === 0) {
      toast.error('На этом этаже нет ячеек для заполнения МОП');
      return;
    }

    setSelection(prev => {
      let targetKeys = keys;
      if (prev.size > 0) {
        const firstKey = Array.from(prev)[0];
        const [fId, eId] = firstKey.split('_');
        const requiredQty = getTargetQty(fId, eId);

        targetKeys = keys.filter(k => {
          const [fid, eid] = k.split('_');
          return getTargetQty(fid, eid) === requiredQty;
        });

        if (targetKeys.length < keys.length && targetKeys.length > 0) {
          toast.success('Выбраны только ячейки с совпадающим количеством МОП');
        } else if (targetKeys.length === 0) {
          toast.error('Нет ячеек, совпадающих по количеству с текущим выбором');
          return prev;
        }
      } else {
        const groups = {};
        keys.forEach(k => {
          const [fid, eid] = k.split('_');
          const qty = getTargetQty(fid, eid);
          if (!groups[qty]) groups[qty] = [];
          groups[qty].push(k);
        });

        const qtys = Object.keys(groups);
        if (qtys.length > 1) {
          toast.error('В этом ряду разное количество МОП. Выберите ячейки вручную.');
          return prev;
        }
      }

      const next = new Set(prev);
      const allSelected = targetKeys.every(k => next.has(k));
      targetKeys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const selectEntrance = entranceNumber => {
    const targetFloors = entranceNumber === 0
      ? floors.filter(f => f.type === 'basement' || f.flags?.isBasement)
      : floors;

    const keys = targetFloors
      .map(f => `${f.id}_${entranceNumber}`)
      .filter(k => {
        const [f, e] = k.split('_');
        return isCellSelectable(f, e);
      });

    if (keys.length === 0) {
      toast.error('В этом столбце нет ячеек для заполнения МОП');
      return;
    }

    setSelection(prev => {
      let targetKeys = keys;
      if (prev.size > 0) {
        const firstKey = Array.from(prev)[0];
        const [fId, eId] = firstKey.split('_');
        const requiredQty = getTargetQty(fId, eId);

        targetKeys = keys.filter(k => {
          const [fid, eid] = k.split('_');
          return getTargetQty(fid, eid) === requiredQty;
        });

        if (targetKeys.length === 0) {
          toast.error('Нет ячеек, совпадающих по количеству');
          return prev;
        }
      } else {
        const groups = {};
        keys.forEach(k => {
          const [fid, eid] = k.split('_');
          const qty = getTargetQty(fid, eid);
          if (!groups[qty]) groups[qty] = [];
          groups[qty].push(k);
        });
        const qtys = Object.keys(groups);
        if (qtys.length > 1) {
          toast.error('В этом столбце разное количество МОП. Выберите вручную.');
          return prev;
        }
      }

      const next = new Set(prev);
      const allSelected = targetKeys.every(k => next.has(k));
      targetKeys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };
  const clearSelection = () => setSelection(new Set());

  useEffect(() => {
    if (selection.size === 0) {
        // УМНОЕ ОБНОВЛЕНИЕ
        setDraftRows(prev => prev.length === 0 ? prev : []);
        return;
    }

    const firstKey = Array.from(selection)[0];
    const [firstFloorId, firstEntranceId] = firstKey.split('_');
    const targetQty = getTargetQty(firstFloorId, firstEntranceId);

    let baseData = [];
    if (selection.size === 1) {
        baseData = (mopGrid[firstFloorId]?.[firstEntranceId] || []).map(m => ({
            id: m.id,
            type: m.type || '',
            area: m.area || '',
            height: m.height || '',
        }));
    }

    const fixedRows = Array.from({ length: targetQty }).map((_, i) => {
        if (baseData[i]) return baseData[i];
        return { id: null, type: '', area: '', height: '' };
    });

    // УМНОЕ ОБНОВЛЕНИЕ: глубокое сравнение, чтобы не вызывать бесконечный цикл
    setDraftRows(prev => {
      if (JSON.stringify(prev) === JSON.stringify(fixedRows)) return prev;
      return fixedRows;
    });

  }, [selection, mopGrid, getTargetQty]);

  const updateDraftRow = (idx, field, value) => {
    if (isReadOnly) return;
    setDraftRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const validateDraftRows = () => {
    if (draftRows.length === 0) return true;

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
      toast.error('Для всех строк обязательны: тип, площадь > 0 и высота > 0');
      return false;
    }
    return true;
  };

  const applyToSelected = async () => {
    if (isReadOnly) return;
    if (!validateDraftRows()) return;
    if (selection.size === 0) return;

    if (draftRows.length === 0 && !confirm('Вы собираетесь удалить все МОП в выбранных ячейках. Продолжить?')) {
        return;
    }

    setHasUnsavedChanges(true);
    const selected = Array.from(selection);
    
    const updates = selected.map(async (key) => {
      const [floorId, entranceNumberRaw] = key.split('_');
      const entranceNumber = parseInt(entranceNumberRaw, 10);
      const entranceId = entranceNumber === 0 ? null : entranceIdByNumber[entranceNumber];
      const existing = mopGrid[floorId]?.[entranceNumber] || [];
      for (const m of existing) {
        // Удаляем только записи с настоящим ID из БД
        if (m.id && !String(m.id).startsWith('temp-')) {
          await deleteMop(m.id);
        }
      }

      for (const row of draftRows) {
        await upsertMop({
          floorId,
          entranceId,
          type: row.type,
          area: row.area,
          height: row.height,
        });
      }
    });

    await Promise.all(updates);
    toast.success(`Применено для ячеек: ${selected.length}`);
  };

  const resetSelected = async () => {
    if (isReadOnly) return;
    if (!confirm('Стереть МОП в выбранных ячейках?')) return;

    setHasUnsavedChanges(true);
    const selected = Array.from(selection);
    const updates = selected.map(async (key) => {
      const [floorId, entranceNumberRaw] = key.split('_');
      const entranceNumber = parseInt(entranceNumberRaw, 10);
      const existing = mopGrid[floorId]?.[entranceNumber] || [];
      for (const m of existing) {
        // Удаляем только записи с настоящим ID из БД
        if (m.id && !String(m.id).startsWith('temp-')) {
          await deleteMop(m.id);
        }
      }
    });
    await Promise.all(updates);
    toast.success('Очищено');
  };

  // --- SAVE & VALIDATION ---
  const waitForPendingMutations = async () => {
    const startedAt = Date.now();
    while (queryClient.isMutating() > 0) {
      if (Date.now() - startedAt > 8000) break;
      await new Promise(r => setTimeout(r, 100));
    }
  };

  const handleSaveStepStatus = async () => {
    if (!building || isReadOnly) return;
    try {
      setIsSavingStatus(true);
      setValidationWarnings([]);

      await saveProjectImmediate({ shouldRefetch: false });
      await waitForPendingMutations();

      const reconcile = await ApiService.reconcileCommonAreasForBlock(currentBlock.id, actor);
      const result = await saveStepBuildingStatuses({ stepId: 'mop', buildingId: building.id });
      setHasUnsavedChanges(false);

      if (reconcile?.removed > 0) {
        toast.warning(`Синхронизация МОП: удалено лишних записей — ${reconcile.removed}`);
      }

      if (result && result.buildingStatus === BLOCK_FILL_STATUS.PARTIAL) {
         const contextData = { composition, buildingDetails, floorData, entrancesData, flatMatrix, mopData: contextMopData };
         const blocks = getStepBlocksForStatus('mop', building, buildingDetails);
         let allErrors = [];
         blocks.forEach(block => {
            const scopedContext = buildScopedContextForBlock('mop', building, block, contextData);
            const errors = validateStepCompletion('mop', scopedContext) || [];
            if (errors.length > 0) allErrors = [...allErrors, ...errors];
         });
         
         if (allErrors.length > 0) {
             setValidationWarnings(allErrors);
             setShowWarningModal(true);
         } else {
             onBack();
         }
      } else {
          onBack();
      }
    } catch(e) {
        console.error(e);
        toast.error('Ошибка сохранения');
    } finally {
      setIsSavingStatus(false);
    }
  };

  // --- RENDER HELPERS ---
  const getCellColor = (floor, entranceNumber, isSelected) => {
     if (isSelected) return 'bg-blue-600 ring-2 ring-blue-300 border-transparent shadow-md transform scale-[1.02] z-10';
     
     const targetQty = getTargetQty(floor.id, entranceNumber);
     const currentMops = mopGrid[floor.id]?.[entranceNumber] || [];
     const isFilled = targetQty > 0 && currentMops.length >= targetQty;
     const hasSome = currentMops.length > 0;
     const isZeroPlan = targetQty === 0;

     if (isZeroPlan && !hasSome) return 'bg-white border-slate-100 opacity-50 cursor-not-allowed';
     if (isZeroPlan && hasSome) return 'bg-red-50 border-red-200 cursor-not-allowed';

     if (isFilled) return 'bg-emerald-50 border-emerald-200';
     if (hasSome) return 'bg-amber-50 border-amber-200';
     
     return 'bg-slate-50 border-slate-200';
  };

  const isStepAvailable = !!currentBlock;

  if (!building) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;
  if (residentialBlocks.length === 0) {
    return <div className="p-8 text-center text-slate-500">Нет жилых блоков</div>;
  }
  if (!currentBlock) return <div className="p-8 text-center text-slate-500">Загрузка...</div>;
  if (!isStepAvailable) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <AlertCircle size={36} />
          </div>
          <h3 className="text-xl font-bold text-slate-700">Настройка МОП недоступна</h3>
          <p className="text-slate-500 max-w-md">
            Инвентаризация МОП производится только для жилых блоков и подземных паркингов.
          </p>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 overflow-hidden pb-4">
       
       <BlockingLoader isOpen={isSavingStatus} message="Сохраняем данные..." />

       {/* HEADER */}
       <div className="flex-none space-y-4 pb-4">
         <ConfigHeader
            building={building}
            isParking={isParking}
            isInfrastructure={isInfrastructure}
            isUnderground={isUnderground}
            onBack={onBack}
            isSticky={false}
            showSaveButton={true}
            onSave={handleSaveStepStatus}
            saveDisabled={isReadOnly || isSavingStatus}
            saveLabel={isSavingStatus ? 'Сохранение...' : 'Сохранить и выйти'}
         />

         <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
             {/* Legend & Actions */}
             <div className="flex items-center gap-4">
                 <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                     <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></div> Заполнено</div>
                     <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-50 border border-amber-200 rounded"></div> Частично</div>
                     <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-50 border border-slate-200 rounded"></div> Пусто</div>
                 </div>
                 
                 <div className="h-6 w-px bg-slate-300 mx-2 hidden md:block"></div>

                 <button
                    onClick={handleResetAll}
                    disabled={isReadOnly}
                    title="Удалить все МОП для этого блока"
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border shadow-sm ${isReadOnly ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200'}`}
                >
                    <Eraser size={14} />
                    <span className="hidden sm:inline">Сбросить всё</span>
                </button>
             </div>
         </div>
       </div>

       {/* CONTENT GRID */}
       <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0">
           
           {/* LEFT MATRIX CARD */}
           <Card className="flex-1 h-full border border-slate-300 shadow-md bg-white p-0 relative flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                    <div className="min-w-max pb-10 pr-6 pl-4 pt-4">
                        
                        {/* STICKY HEADER MATRIX */}
                        <div className="flex sticky top-0 z-40 bg-slate-100/95 backdrop-blur-md border-b border-slate-300 pb-3 pt-3 mb-2 shadow-sm">
                            <div className="w-24 shrink-0 sticky left-0 z-50 bg-slate-100 border-r border-slate-300"></div>

                            {residentialBlocks.map((b, i) => {
                                const isActive = i === activeBlockIndex;
                                const blockLabel = formatBlockSwitcherLabel({ building, block: b, buildingDetails });

                                if (!isActive) {
                                    return (
                                        <button
                                            key={b.id}
                                            onClick={() => setActiveBlockIndex(i)}
                                            className="w-12 mx-1 shrink-0 bg-slate-200/50 hover:bg-slate-300 border border-slate-300 rounded-lg flex flex-col items-center justify-center transition-colors group min-h-[60px]"
                                            title={blockLabel}
                                        >
                                            <span style={{ writingMode: 'vertical-rl' }} className="rotate-180 text-xs font-bold text-slate-500 group-hover:text-slate-800 whitespace-nowrap px-1">
                                                {blockLabel}
                                            </span>
                                        </button>
                                    );
                                }

                                return (
                                    <div key={b.id} className="flex flex-col mx-1 bg-blue-50/50 border border-blue-200 rounded-lg shadow-sm">
                                        <div className="text-center text-xs font-bold text-blue-800 bg-blue-100/50 py-1.5 border-b border-blue-200 px-2 truncate min-h-[28px]">
                                            {blockLabel}
                                        </div>
                                        <div className="flex p-1 h-full items-end">
                                            {entrances.map(e => (
                                                <div key={e.id} className="w-24 mx-1 flex flex-col items-center group shrink-0 justify-end">
                                                    <button
                                                        onClick={() => selectEntrance(e.number)}
                                                        className="text-[11px] font-black text-slate-600 uppercase hover:text-blue-700 flex flex-col items-center gap-1 transition-colors"
                                                    >
                                                        <span className="bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
                                                            Подъезд {e.number}
                                                        </span>
                                                        <ArrowDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                                                    </button>
                                                </div>
                                            ))}
                                            {entrances.length === 0 && (
                                                <div className="w-24 h-8 flex items-center justify-center text-xs text-slate-400">Нет подъездов</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {hasBasements && (
                                <div className="w-24 mx-2 flex flex-col items-center group shrink-0 justify-end">
                                    <button
                                        onClick={() => selectEntrance(0)}
                                        className="text-xs font-black text-slate-500 uppercase hover:text-amber-700 flex flex-col items-center gap-1 transition-colors h-full justify-end"
                                    >
                                        <span className="bg-amber-100/60 px-2 py-1 rounded border border-amber-200/80 shadow-sm text-[10px] text-amber-900 tracking-tight leading-tight text-center mb-1">
                                            Вне<br/>подъездов
                                        </span>
                                        <ArrowDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-600" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* MATRIX ROWS */}
                        <div className="flex flex-col gap-2 min-w-max">
                            {floors.map(floor => {
                                const isBasement = floor.type === 'basement' || floor.flags?.isBasement;
                                return (
                                    <div key={floor.id} className="flex items-stretch hover:bg-slate-50 rounded-lg p-1 -ml-1 transition-colors">
                                        <div className="sticky left-0 z-30 bg-slate-50 pr-2 rounded-l-lg border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <button
                                                onClick={() => selectFloor(floor.id)}
                                                className="w-24 shrink-0 text-right pr-4 group flex flex-col items-end py-3"
                                            >
                                                <span className="font-black text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                                                    {floor.label || floor.index}
                                                </span>
                                                <FloorTypeBadge type={floor.type} />
                                            </button>
                                        </div>

                                        <div className="flex items-center">
                                            {residentialBlocks.map((b, i) => {
                                                const isActive = i === activeBlockIndex;
                                                if (!isActive) {
                                                    return <div key={b.id} className="w-12 mx-1 shrink-0 bg-slate-100/50 border border-slate-200 border-dashed rounded-lg opacity-50 my-1 h-full min-h-[64px]"></div>;
                                                }

                                                return (
                                                    <div key={b.id} className="flex px-1 mx-1 bg-blue-50/10 border-x border-blue-100/50 items-center">
                                                        {entrances.map(e => {
                                                            const key = `${floor.id}_${e.number}`;
                                                            const isSelected = selection.has(key);
                                                            const targetQty = getTargetQty(floor.id, e.number);
                                                            const currentMops = mopGrid[floor.id]?.[e.number] || [];
                                                            const factQty = currentMops.length;

                                                            return (
                                                                <button
                                                                    key={e.id}
                                                                    onClick={() => toggleCell(floor.id, e.number)}
                                                                    className={`
                                                                        w-24 h-16 mx-1 rounded-xl border flex flex-col items-center justify-center transition-all relative overflow-hidden shrink-0
                                                                        ${getCellColor(floor, e.number, isSelected)}
                                                                    `}
                                                                >
                                                                    {targetQty > 0 || factQty > 0 ? (
                                                                        <>
                                                                            <div className="flex items-baseline gap-0.5">
                                                                                <span className={`text-xl font-black ${isSelected ? 'text-white' : 'text-slate-700'}`}>{factQty}</span>
                                                                                <span className={`text-xs font-bold opacity-50 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>/ {targetQty}</span>
                                                                            </div>
                                                                            <span className={`text-[9px] font-bold uppercase mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>МОП</span>
                                                                        </>
                                                                    ) : (
                                                                        <span className={`text-2xl font-black opacity-10 ${isSelected ? 'text-white' : 'text-slate-400'}`}>-</span>
                                                                    )}
                                                                    {isSelected && (
                                                                        <div className="absolute top-1 right-1 bg-white/20 text-white rounded-full p-0.5 shadow-sm">
                                                                            <Check size={10} strokeWidth={4} />
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {hasBasements && (
                                            <div className="flex items-center px-1 mx-1">
                                                {isBasement ? (() => {
                                                    const key = `${floor.id}_0`;
                                                    const isSelected = selection.has(key);
                                                    const targetQty = getTargetQty(floor.id, 0);
                                                    const currentMops = mopGrid[floor.id]?.[0] || [];
                                                    const factQty = currentMops.length;
                                                    return (
                                                        <button
                                                            key="ent_0"
                                                            onClick={() => toggleCell(floor.id, 0)}
                                                            className={`
                                                                w-24 h-16 mx-1 rounded-xl border flex flex-col items-center justify-center transition-all relative overflow-hidden shrink-0
                                                                ${getCellColor(floor, 0, isSelected)}
                                                            `}
                                                        >
                                                            {targetQty > 0 || factQty > 0 ? (
                                                                <>
                                                                    <div className="flex items-baseline gap-0.5">
                                                                        <span className={`text-xl font-black ${isSelected ? 'text-white' : 'text-slate-700'}`}>{factQty}</span>
                                                                        <span className={`text-xs font-bold opacity-50 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>/ {targetQty}</span>
                                                                    </div>
                                                                    <span className={`text-[9px] font-bold uppercase mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>МОП</span>
                                                                </>
                                                            ) : (
                                                                <span className={`text-2xl font-black opacity-10 ${isSelected ? 'text-white' : 'text-slate-400'}`}>-</span>
                                                            )}
                                                            {isSelected && (
                                                                <div className="absolute top-1 right-1 bg-white/20 text-white rounded-full p-0.5 shadow-sm">
                                                                    <Check size={10} strokeWidth={4} />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })() : (
                                                    <div className="w-24 h-16 mx-1 shrink-0 bg-transparent"></div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
           </Card>

           {/* RIGHT PANEL - EDITOR */}
           <div className="w-full lg:w-96 shrink-0 h-full flex flex-col overflow-hidden bg-white rounded-2xl shadow-xl border border-blue-100">
                {selection.size > 0 ? (
                    <>
                        <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <CheckCircle2 size={18} />
                                    {selection.size} {selection.size === 1 ? 'ячейка' : 'ячеек'}
                                </h3>
                                <p className="text-blue-100 text-xs">Редактирование списка МОП</p>
                            </div>
                            <button onClick={clearSelection} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                            {draftRows.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                    <p className="text-sm">Список помещений пуст</p>
                                    <p className="text-xs mt-1">
                                        В выбранных ячейках не запланировано создание МОП.
                                        <br/>
                                        Измените количество в шаге "Подъезды".
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {draftRows.map((row, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2 animate-in slide-in-from-right-2 duration-300">
                                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1">
                                                <span>Помещение #{idx + 1}</span>
                                                {/* DELETE BUTTON REMOVED */}
                                            </div>
                                            <div className="grid grid-cols-1 gap-2">
                                                <Select 
                                                    value={row.type || ''} 
                                                    onChange={e => updateDraftRow(idx, 'type', e.target.value)} 
                                                    disabled={isReadOnly}
                                                    className="w-full text-sm"
                                                >
                                                    <option value="">Выберите тип...</option>
                                                    {mopTypeOptions.map(t => (
                                                        <option key={t.code} value={t.label || mopLabelByCode[t.code] || t.code}>
                                                            {t.label || mopLabelByCode[t.code] || t.code}
                                                        </option>
                                                    ))}
                                                </Select>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <DebouncedInput 
                                                            type="number" min="0" step="0.01" 
                                                            value={row.area || ''} 
                                                            onChange={v => updateDraftRow(idx, 'area', v)} 
                                                            placeholder="Площадь м²" 
                                                            disabled={isReadOnly}
                                                            className="text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <DebouncedInput 
                                                            type="number" min="0" step="0.01" 
                                                            value={row.height || ''} 
                                                            onChange={v => updateDraftRow(idx, 'height', v)} 
                                                            placeholder="Высота м" 
                                                            disabled={isReadOnly}
                                                            className="text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ADD BUTTON REMOVED */}
                        </div>

                        <div className="bg-white p-4 border-t border-slate-100 shadow-lg z-10 space-y-3">
                            {selection.size > 1 && (
                                <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-800 text-xs rounded border border-blue-100">
                                    <Copy size={14} className="shrink-0" />
                                    <span>Внимание: этот список будет применен ко всем {selection.size} выбранным ячейкам.</span>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={resetSelected} disabled={isReadOnly} className="shrink-0 px-3 text-red-500 hover:bg-red-50 hover:text-red-600">
                                    <RotateCcw size={16} />
                                </Button>
                                <Button onClick={applyToSelected} disabled={isReadOnly} className="w-full">
                                    Применить изменения
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center h-full text-slate-400">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <MousePointer2 size={32} className="text-slate-300" />
                        </div>
                        <h3 className="font-bold text-slate-600 mb-1">Выберите ячейки</h3>
                        <p className="text-sm">
                            Кликните по ячейкам в матрице слева, чтобы заполнить данные МОП согласно плану.
                        </p>
                    </div>
                )}
           </div>
       </div>

       <Modal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        title="Сохранено с предупреждениями"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-yellow-50 text-yellow-900 rounded-xl border border-yellow-200">
            <AlertCircle className="shrink-0 text-yellow-600" />
            <div>
              <p className="font-bold">Данные сохранены частично</p>
              <p className="text-sm mt-1">
                Некоторые блоки не прошли проверку заполнения. Статус "Заполнено" будет присвоен только после исправления всех ошибок.
              </p>
            </div>
          </div>
          <div className="max-h-[40vh] overflow-y-auto border rounded-xl divide-y">
            {validationWarnings.map((err, idx) => (
              <div key={idx} className="p-3 text-sm hover:bg-slate-50">
                <div className="font-bold text-slate-700">{err.title}</div>
                <div className="text-slate-500 mt-0.5">{err.description}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setShowWarningModal(false)}>Понятно</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}








