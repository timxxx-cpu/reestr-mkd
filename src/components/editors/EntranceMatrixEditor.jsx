import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  Building2,
  Car,
  Box,
  Store,
  LayoutGrid,
  CheckSquare,
  MousePointer2,
  X,
  Check,
  Layers,
  Eraser,
  Wand2,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useDirectFloors } from '@hooks/api/useDirectFloors';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix';
import { useBuildingType } from '@hooks/useBuildingType';
import { Card, DebouncedInput, useReadOnly, Button, Label, Modal, BlockingLoader } from '@components/ui/UIKit';
import { Validators } from '@lib/validators';
import { ApiService } from '@lib/api-service';
import ConfigHeader from './configurator/ConfigHeader';
import { formatBlockSwitcherLabel } from '@lib/building-details';
import { useToast } from '@context/ToastContext';
import { STEPS_CONFIG } from '@lib/constants';
import {
  BLOCK_FILL_STATUS,
  validateStepCompletion,
  getStepBlocksForStatus,
  buildScopedContextForBlock,
} from '@lib/step-validators';

// --- Helpers ---
const getBlockIcon = type => {
  if (type === 'residential') return Building2;
  if (type === 'parking') return Car;
  if (type === 'infrastructure') return Box;
  if (type === 'non_residential') return Store;
  return LayoutGrid;
};

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

// --- Components ---

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

const FloorTypeBadge = ({ type }) => {
  const map = {
    residential: { color: 'bg-blue-100 text-blue-700', label: 'Жилой' },
    mixed: { color: 'bg-violet-100 text-violet-700', label: 'Жилой/Нежилой.' },
    technical: { color: 'bg-amber-100 text-amber-700', label: 'Технический' },
    basement: { color: 'bg-slate-200 text-slate-600', label: 'Подвал' },
    office: { color: 'bg-emerald-100 text-emerald-700', label: 'Нежилой' },
    parking_floor: { color: 'bg-indigo-100 text-indigo-700', label: 'Паркинг' },
  };
  const style = map[type] || map.residential;
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${style.color}`}>
      {style.label}
    </span>
  );
};

const CellContent = ({ apts, units, mops, isSelected }) => {
  const textColor = (baseClass) => isSelected ? 'text-white' : baseClass;
  const labelColor = isSelected ? 'text-blue-100' : 'text-slate-400';
  const dividerColor = isSelected ? 'border-blue-400' : 'border-slate-100';

  const items = [
    { key: 'apts', val: apts, label: 'КВ', color: 'text-blue-600' },
    { key: 'units', val: units, label: 'ОФ', color: 'text-emerald-600' },
    { key: 'mop', val: mops, label: 'МОП', color: 'text-amber-600' }
  ].filter(d => Number(d.val) > 0);

  if (items.length === 0) {
    return <span className={`text-xl font-black opacity-20 ${textColor('text-slate-400')}`}>-</span>;
  }

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className="flex flex-col items-center justify-center -space-y-0.5 animate-in zoom-in duration-200">
        <span className={`text-xl font-black ${textColor(item.color)}`}>{item.val}</span>
        <span className={`text-[9px] font-bold uppercase ${labelColor}`}>{item.label}</span>
      </div>
    );
  }

  if (items.length === 2) {
    return (
      <div className={`flex w-full h-full divide-x ${dividerColor}`}>
        {items.map((item) => (
          <div key={item.key} className="flex-1 flex flex-col items-center justify-center min-w-0 px-1">
            <span className={`text-sm font-black leading-none ${textColor(item.color)} truncate w-full text-center`}>
                {item.val}
            </span>
            <span className={`text-[8px] font-bold uppercase mt-0.5 ${labelColor}`}>{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className={`flex flex-1 border-b ${dividerColor} divide-x ${dividerColor}`}>
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
           <span className={`text-xs font-black leading-none ${textColor(items[0].color)}`}>{items[0].val}</span>
           <span className={`text-[7px] font-bold uppercase ${labelColor}`}>{items[0].label}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
           <span className={`text-xs font-black leading-none ${textColor(items[1].color)}`}>{items[1].val}</span>
           <span className={`text-[7px] font-bold uppercase ${labelColor}`}>{items[1].label}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <span className={`text-xs font-black leading-none ${textColor(items[2].color)}`}>{items[2].val}</span>
          <span className={`text-[7px] font-bold uppercase ${labelColor}`}>{items[2].label}</span>
      </div>
    </div>
  );
};


export default function EntranceMatrixEditor({ buildingId, onBack }) {
  const { 
    projectId, 
    buildingDetails, 
    saveStepBuildingStatuses,
    saveProjectImmediate,
    setHasUnsavedChanges,
    applicationInfo,
    composition,
    floorData,
    entrancesData,
    flatMatrix,
    mopData
  } = useProject();
  
  const toast = useToast();
  const isReadOnly = useReadOnly();
  const queryClient = useQueryClient();

  // --- State ---
  const [selection, setSelection] = useState(new Set()); 
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [linkedStylobateFloors, setLinkedStylobateFloors] = useState([]);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // --- Data Loading ---
  const { buildings } = useDirectBuildings(projectId);
  const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);

  const residentialBlocks = useMemo(() => {
    if (!building?.blocks?.length) return [];
    return building.blocks.filter(b => b.type === 'residential');
  }, [building]);

  const currentBlock = useMemo(
    () => residentialBlocks[activeBlockIndex],
    [residentialBlocks, activeBlockIndex]
  );

  const typeInfo = useBuildingType(building);
  const { isParking } = typeInfo;
  const isUnderground = false;

  const { floors: rawFloors, updateFloor } = useDirectFloors(currentBlock?.id);
  const { entrances, matrixMap, updateCell, syncEntrances } = useDirectMatrix(currentBlock?.id);

  // --- Effects ---
  useEffect(() => {
    if (activeBlockIndex < residentialBlocks.length) return;
    setActiveBlockIndex(0);
    setSelection(new Set());
  }, [activeBlockIndex, residentialBlocks.length]);

  useEffect(() => {
    let cancelled = false;
    const loadLinkedStylobateFloors = async () => {
      if (!building?.blocks?.length || !currentBlock?.id) {
        if (!cancelled) setLinkedStylobateFloors([]);
        return;
      }
      const linkedStylobateBlocks = building.blocks.filter(block => {
        if (block.type !== 'non_residential') return false;
        const detailsKey = `${building.id}_${block.id}`;
        const details = buildingDetails?.[detailsKey] || {};
        return (
          Array.isArray(details.parentBlocks) && details.parentBlocks.includes(currentBlock.id)
        );
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
        console.error('Failed to load linked stylobate floors', e);
        if (!cancelled) setLinkedStylobateFloors([]);
      }
    };
    loadLinkedStylobateFloors();
    return () => {
      cancelled = true;
    };
  }, [building, buildingDetails, currentBlock]);

  useEffect(() => {
    if (!currentBlock || isReadOnly) return;
    const targetCount = parseInt(currentBlock.entrances || currentBlock.inputs || 0, 10);
    if (entrances.length === 0 && Number.isFinite(targetCount) && targetCount > 0) {
      syncEntrances(targetCount).catch(e => console.error('Sync entrances failed', e));
    }
  }, [entrances.length, currentBlock, isReadOnly, syncEntrances]);

  // --- Logic ---
  const floors = useMemo(() => {
    const residentialFloors = rawFloors.filter(f => !(f.isStylobate || f.flags?.isStylobate));
    const map = new Map();
    [...residentialFloors, ...linkedStylobateFloors].forEach(floor => {
      if (!floor?.id) return;
      map.set(floor.id, floor);
    });
    return Array.from(map.values()).sort(
      (a, b) => (Number(b.index) || 0) - (Number(a.index) || 0)
    );
  }, [rawFloors, linkedStylobateFloors]);

  // --- Selection & Validation ---
  const toggleCell = (floorId, entNum) => {
    const key = `${floorId}_${entNum}`;
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectFloor = floorId => {
    const newKeys = entrances.map(e => `${floorId}_${e.number}`);
    setSelection(prev => {
      const next = new Set(prev);
      const allSelected = newKeys.every(k => prev.has(k));
      newKeys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const selectEntrance = entNum => {
    const newKeys = floors.map(f => `${f.id}_${entNum}`);
    setSelection(prev => {
      const next = new Set(prev);
      const allSelected = newKeys.every(k => prev.has(k));
      newKeys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const clearSelection = () => setSelection(new Set());

  const isFieldEnabled = (floor, field) => {
    const isLinkedStylobate = floor?.blockId && currentBlock?.id && floor.blockId !== currentBlock.id;
    if (field === 'apts' && isLinkedStylobate) return true;
    return Validators.checkFieldAvailability(floor, field, isUnderground);
  };

  // --- Edit Actions ---
  const selectedData = useMemo(() => {
    if (selection.size === 0) return null;
    const keys = Array.from(selection);
    
    const selectedFloorIds = new Set(keys.map(k => k.split('_')[0]));
    const selectedFloors = floors.filter(f => selectedFloorIds.has(f.id));

    const canEditApts = selectedFloors.every(f => isFieldEnabled(f, 'apts'));
    const canEditUnits = selectedFloors.every(f => isFieldEnabled(f, 'units'));
    const canEditMop = selectedFloors.every(f => isFieldEnabled(f, 'mopQty'));

    const firstVal = matrixMap[keys[0]] || { apts: '', units: '', mopQty: '' };
    const isUniform = field => keys.every(k => (matrixMap[k]?.[field] || '') === (firstVal[field] || ''));
    
    return {
        apts: isUniform('apts') ? firstVal.apts : '',
        units: isUniform('units') ? firstVal.units : '',
        mopQty: isUniform('mopQty') ? firstVal.mopQty : '',
        mixed: {
            apts: !isUniform('apts'),
            units: !isUniform('units'),
            mopQty: !isUniform('mopQty')
        },
        permissions: { apts: canEditApts, units: canEditUnits, mop: canEditMop },
        count: selection.size
    };
  }, [selection, matrixMap, floors]);

  const handleBulkUpdate = async (field, value) => {
      if (isReadOnly) return;
      setHasUnsavedChanges(true);
      const updates = [];
      selection.forEach(key => {
          const [floorId, entNum] = key.split('_');
          const floor = floors.find(f => f.id === floorId);
          if (floor && isFieldEnabled(floor, field)) {
             updates.push(updateCell({ floorId, entranceNumber: parseInt(entNum), values: { [field]: value } }));
          }
      });
      await Promise.all(updates);
  };

  const autoFill = async () => {
    if (isReadOnly) return;
    if (!confirm('Заполнить матрицу типовыми значениями (4 кв. на этаж)?')) return;
    setHasUnsavedChanges(true);
    const promises = [];
    floors.forEach(f => {
      entrances.forEach(e => {
        let apts = 0;
        if (['residential', 'attic'].includes(f.type)) apts = 4;
        if (f.type === 'mixed') apts = 3;
        if (apts > 0 || f.isCommercial) {
          promises.push(updateCell({ floorId: f.id, entranceNumber: e.number, values: { apts, mopQty: 1, units: f.isCommercial ? 1 : 0 } }));
        }
      });
    });
    await Promise.all(promises);
  };

  const toggleDuplexForSelectedFloors = async () => {
      if (isReadOnly) return;
      const floorIds = new Set(Array.from(selection).map(k => k.split('_')[0]));
      let successCount = 0;
      let failCount = 0;
      const sortedFloors = floors.sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));
      const updates = [];

      floorIds.forEach(fid => {
          const floorIdx = sortedFloors.findIndex(f => f.id === fid);
          if (floorIdx === -1) return;
          const floor = sortedFloors[floorIdx];
          const newValue = !floor.isDuplex;

          if (newValue) {
              if (!['residential', 'mixed'].includes(floor.type)) { failCount++; return; }
              const prev = sortedFloors[floorIdx - 1];
              const next = sortedFloors[floorIdx + 1];
              if ((prev?.isDuplex) || (next?.isDuplex)) { failCount++; return; }
              let canGoDown = prev && ['basement', 'tsokol'].includes(prev.type);
              let canGoUp = false;
              if (next) {
                 const isNextLiving = ['residential', 'mixed'].includes(next.type);
                 const isNextRoof = ['attic', 'roof'].includes(next.type);
                 if (isNextLiving || isNextRoof) canGoUp = true;
              }
              if (!canGoDown && !canGoUp) { failCount++; return; }
          }
          updates.push(updateFloor({ id: floor.id, updates: { isDuplex: newValue } }));
          successCount++;
      });

      if (updates.length > 0) {
          setHasUnsavedChanges(true);
      }

      await Promise.all(updates);
      if (successCount > 0) toast.success(`Обновлено ${successCount} этажей`);
      if (failCount > 0) toast.error(`Не удалось обновить ${failCount} этажей (нарушение правил дуплекса)`);
  };

  const getCellColor = (floor, isSelected) => {
      if (isSelected) return 'bg-blue-600 ring-2 ring-blue-300 border-transparent shadow-md transform scale-[1.02] z-10';
      if (floor.isDuplex) return 'bg-purple-50 border-purple-200';
      switch (floor.type) {
          case 'residential': return 'bg-blue-50 border-blue-100 hover:bg-blue-100';
          case 'mixed': return 'bg-violet-50 border-violet-100 hover:bg-violet-100';
          case 'office': return 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100';
          case 'technical': return 'bg-amber-50 border-amber-100 opacity-80';
          case 'basement': return 'bg-slate-100 border-slate-200';
          default: return 'bg-white border-slate-100';
      }
  };

  // --- Save Logic ---
  const waitForPendingMutations = async () => {
    const startedAt = Date.now();
    const timeoutMs = 8000;
    while (queryClient.isMutating() > 0) {
      if (Date.now() - startedAt > timeoutMs) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const collectValidationErrors = (stepId, building) => {
    const contextData = {
      composition,
      buildingDetails,
      floorData,
      entrancesData,
      flatMatrix,
      mopData,
    };
    const blocks = getStepBlocksForStatus(stepId, building, buildingDetails);
    let allErrors = [];

    blocks.forEach(block => {
      const scopedContext = buildScopedContextForBlock(stepId, building, block, contextData);
      const errors = validateStepCompletion(stepId, scopedContext) || [];
      if (errors.length > 0) {
        allErrors = [...allErrors, ...errors];
      }
    });

    return allErrors;
  };

  const handleSave = async () => {
    const stepId = 'entrances';
    if (!building) return;
    if (isReadOnly) return;

    try {
      setIsSavingStatus(true);
      setValidationWarnings([]);

      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      
      await new Promise(resolve => setTimeout(resolve, 350));
      await saveProjectImmediate({ shouldRefetch: false });
      await waitForPendingMutations();

      const result = await saveStepBuildingStatuses({
        stepId,
        buildingId: building.id,
      });

      setHasUnsavedChanges(false);

      if (result && result.buildingStatus === BLOCK_FILL_STATUS.PARTIAL) {
        const errors = collectValidationErrors(stepId, building);
        if (errors.length > 0) {
          setValidationWarnings(errors);
          setShowWarningModal(true);
        }
      }
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Ошибка при сохранении');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const currentWorkflowStepIndex = applicationInfo?.currentStepIndex ?? 0;
  const currentWorkflowStepId = STEPS_CONFIG[currentWorkflowStepIndex]?.id;
  const isCurrentStepActive = 'entrances' === currentWorkflowStepId;
  const showSave = !isReadOnly && isCurrentStepActive;


  if (!building) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;
  if (residentialBlocks.length === 0)
    return <div className="p-12 text-center text-slate-500">Нет жилых блоков</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 overflow-hidden pb-4">
      
      <BlockingLoader isOpen={isSavingStatus} message="Сохраняем данные..." />

      {/* HEADER */}
      <div className="flex-none space-y-4 pb-4">
        <ConfigHeader
          building={building}
          isParking={isParking}
          isInfrastructure={false}
          isUnderground={isUnderground}
          onBack={onBack}
          isSticky={false}
          showSaveButton={showSave}
          onSave={handleSave}
          saveDisabled={isSavingStatus}
          saveLabel={isSavingStatus ? 'Сохраняем…' : 'Сохранить'}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-max overflow-x-auto max-w-full shadow-inner border border-slate-700 custom-scrollbar">
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
                <div className="flex items-center gap-2 text-xs text-slate-500 mr-2 hidden sm:flex">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-100 rounded"></div> Жилой</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-violet-100 rounded"></div> Жилой/Нежилой</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 rounded"></div> Офис</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-100 rounded"></div> Дуплекс</div>
                </div>
                <button
                    onClick={autoFill}
                    disabled={isReadOnly}
                    title="Заполнить типовыми (4 кв/эт)"
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border shadow-sm ${isReadOnly ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200'}`}
                >
                    <Wand2 size={14} />
                    <span className="hidden sm:inline">Типовые</span>
                </button>
            </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0">
         
         {/* LEFT GRID */}
         <Card className="flex-1 h-full border border-slate-300 shadow-md bg-white p-0 relative flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                <div className="min-w-max pb-10 pr-6 pl-4 pt-4">
                    
                    {/* STICKY HEADER (Обновлен дизайн) */}
                    <div className="flex sticky top-0 z-40 bg-slate-100/95 backdrop-blur-md border-b border-slate-300 pb-3 pt-3 mb-2 shadow-sm">
                        {/* Corner */}
                        <div className="w-24 shrink-0 sticky left-0 z-50 bg-slate-100 border-r border-slate-300"></div> 
                        
                        {entrances.map(e => (
                            <div key={e.id} className="w-24 mx-1 flex flex-col items-center group shrink-0 justify-end">
                                 <button 
                                    onClick={() => selectEntrance(e.number)}
                                    className="text-xs font-black text-slate-600 uppercase hover:text-blue-700 flex flex-col items-center gap-1 transition-colors"
                                 >
                                     <span className="bg-white/60 px-2 py-1 rounded border border-slate-200/50 shadow-sm">
                                        Подъезд {e.number}
                                     </span>
                                     <ArrowDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                                 </button>
                            </div>
                        ))}
                    </div>

                    {/* GRID ROWS */}
                    <div className="flex flex-col gap-2">
                        {floors.map(floor => (
                            <div key={floor.id} className="flex items-center hover:bg-slate-50 rounded-lg p-1 -ml-1 transition-colors">
                                {/* STICKY LEFT COL (Обновлен дизайн) */}
                                <div className="sticky left-0 z-30 bg-slate-50 pr-2 rounded-l-lg border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <button 
                                        onClick={() => selectFloor(floor.id)}
                                        className="w-24 shrink-0 text-right pr-4 group flex flex-col items-end py-3"
                                    >
                                        <span className="font-black text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                                            {floor.label}
                                        </span>
                                        <FloorTypeBadge type={floor.type} />
                                        {floor.isDuplex && <span className="text-[9px] text-purple-600 font-bold tracking-tighter">DUPLEX</span>}
                                    </button>
                                </div>

                                {/* CELLS */}
                                {entrances.map(e => {
                                    const key = `${floor.id}_${e.number}`;
                                    const isSelected = selection.has(key);
                                    const cellData = matrixMap[key] || {};

                                    return (
                                        <button
                                            key={e.id}
                                            onClick={() => toggleCell(floor.id, e.number)}
                                            className={`
                                                w-24 h-16 mx-1 rounded-xl border flex flex-col items-center justify-center transition-all relative overflow-hidden shrink-0
                                                ${getCellColor(floor, isSelected)}
                                            `}
                                        >
                                            <CellContent 
                                                apts={cellData.apts}
                                                units={cellData.units}
                                                mops={cellData.mopQty}
                                                isSelected={isSelected}
                                            />
                                            {isSelected && (
                                                <div className="absolute top-1 right-1 bg-white/20 text-white rounded-full p-0.5 shadow-sm">
                                                    <Check size={10} strokeWidth={4} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
         </Card>

         {/* RIGHT PANEL */}
         <div className="w-full lg:w-80 shrink-0 h-full flex flex-col overflow-hidden bg-white rounded-2xl shadow-xl border border-blue-100">
             {selection.size > 0 ? (
                 <>
                     <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
                         <div>
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <CheckSquare size={18} />
                                {selection.size} {selection.size === 1 ? 'ячейка' : 'ячеек'}
                            </h3>
                            <p className="text-blue-100 text-xs">Выбрано для редактирования</p>
                         </div>
                         <button onClick={clearSelection} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                             <X size={18} />
                         </button>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {isReadOnly && (
                            <div className="p-3 bg-slate-100 rounded text-xs text-slate-500 text-center">
                                Режим просмотра
                            </div>
                        )}

                        <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                <Label>Квартиры</Label>
                                {!selectedData?.permissions.apts && <span className="text-[10px] text-red-400 font-bold">Недоступно</span>}
                             </div>
                             <DebouncedInput 
                                 type="number"
                                 min="0"
                                 disabled={isReadOnly || !selectedData?.permissions.apts}
                                 placeholder={selectedData?.mixed.apts ? "Разные значения" : "0"}
                                 value={selectedData?.apts}
                                 onChange={(v) => handleBulkUpdate('apts', v)}
                                 className={`text-lg font-bold ${!selectedData?.permissions.apts ? 'bg-slate-100 text-slate-400' : ''}`}
                             />
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className={!selectedData?.permissions.units ? 'text-slate-400' : ''}>Офисы</Label>
                                <DebouncedInput 
                                    type="number"
                                    min="0"
                                    disabled={isReadOnly || !selectedData?.permissions.units}
                                    placeholder={selectedData?.mixed.units ? "..." : "0"}
                                    value={selectedData?.units}
                                    onChange={(v) => handleBulkUpdate('units', v)}
                                    className={!selectedData?.permissions.units ? 'bg-slate-100' : ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className={!selectedData?.permissions.mop ? 'text-slate-400' : ''}>МОП</Label>
                                <DebouncedInput 
                                    type="number"
                                    min="0"
                                    disabled={isReadOnly || !selectedData?.permissions.mop}
                                    placeholder={selectedData?.mixed.mopQty ? "..." : "0"}
                                    value={selectedData?.mopQty}
                                    onChange={(v) => handleBulkUpdate('mopQty', v)}
                                    className={!selectedData?.permissions.mop ? 'bg-slate-100' : ''}
                                />
                            </div>
                        </div>

                         <div className="pt-6 border-t border-slate-100">
                            <Label className="mb-2 block">Конфигурация этажей</Label>
                            <Button 
                                variant="secondary" 
                                className="w-full justify-between group"
                                onClick={toggleDuplexForSelectedFloors}
                                disabled={isReadOnly}
                            >
                                <span className="flex items-center gap-2 text-slate-700 group-hover:text-purple-700 transition-colors">
                                    <Layers size={14}/> 
                                    Статус "Дуплекс"
                                </span>
                                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-500 uppercase font-bold">Изменить</span>
                            </Button>
                            {!selectedData?.permissions.apts && !selectedData?.permissions.units && (
                                <div className="mt-3 flex gap-2 items-start p-2 bg-amber-50 rounded border border-amber-100 text-amber-700">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5"/>
                                    <p className="text-[10px] leading-tight">
                                        В выбранном диапазоне есть этажи, где запрещено создание помещений.
                                    </p>
                                </div>
                            )}
                        </div>
                     </div>
                     
                     <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between shrink-0">
                         <button 
                            className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1"
                            onClick={() => {
                                if(confirm('Очистить данные в выбранных ячейках?')) {
                                    handleBulkUpdate('apts', '');
                                    handleBulkUpdate('units', '');
                                    handleBulkUpdate('mopQty', '');
                                }
                            }}
                         >
                            <Eraser size={12}/> Очистить
                         </button>
                         <button 
                            className="text-xs font-bold text-blue-600 hover:text-blue-700"
                            onClick={clearSelection}
                         >
                            Готово
                         </button>
                     </div>
                 </>
             ) : (
                 <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center h-full text-slate-400">
                     <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                        <MousePointer2 size={32} className="text-slate-300" />
                     </div>
                     <h3 className="font-bold text-slate-600 mb-1">Выберите ячейки</h3>
                     <p className="text-sm">
                        Кликните по ячейкам, чтобы изменить данные.
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
            <AlertTriangle className="shrink-0 text-yellow-600" />
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