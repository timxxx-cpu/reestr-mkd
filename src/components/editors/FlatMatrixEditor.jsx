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
  ArrowDown
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useDirectFloors } from '@hooks/api/useDirectFloors';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix';
import { useDirectUnits } from '@hooks/api/useDirectUnits';
import { useBuildingType } from '@hooks/useBuildingType';
import { Card, useReadOnly, Modal, Button, Label, Select, BlockingLoader, DebouncedInput } from '@components/ui/UIKit';
import { ApiService } from '@lib/api-service';
import ConfigHeader from './configurator/ConfigHeader';
import { formatBlockSwitcherLabel } from '@lib/building-details';
import { useMatrixData } from '@hooks/useMatrixData';
import { useToast } from '@context/ToastContext';

// [CHANGED] Компактные стили и мини-лейблы
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

const getBlockIcon = type => {
  if (type === 'residential') return Building2;
  if (type === 'parking') return Car;
  if (type === 'infrastructure') return Box;
  if (type === 'non_residential') return Store;
  return LayoutGrid;
};

export default function FlatMatrixEditor({ buildingId, onBack }) {
  const { projectId, buildingDetails, saveStepBuildingStatuses } = useProject();
  const isReadOnly = useReadOnly();
  const toast = useToast();

  const { buildings } = useDirectBuildings(projectId);
  const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);
  const typeInfo = useBuildingType(building);
  const { isParking, isInfrastructure, isUnderground } = typeInfo;

  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const currentBlock = useMemo(() => building?.blocks?.[activeBlockIndex], [building, activeBlockIndex]);

  const { floors: rawFloors } = useDirectFloors(currentBlock?.id);
  const [linkedStylobateFloors, setLinkedStylobateFloors] = useState([]);
  
  useEffect(() => {
    let cancelled = false;
    const loadLinked = async () => {
      if (!building?.blocks || !currentBlock) return;
      const linked = building.blocks.filter(b => {
         if (b.type !== 'non_residential') return false;
         const d = buildingDetails?.[`${building.id}_${b.id}`] || {};
         return Array.isArray(d.parentBlocks) && d.parentBlocks.includes(currentBlock.id);
      });
      if (!linked.length) { if(!cancelled) setLinkedStylobateFloors([]); return; }
      try {
        const res = await Promise.all(linked.map(b => ApiService.getFloors(b.id)));
        const stylo = res.flat().filter(isLinkedStylobateFloor);
        if (!cancelled) setLinkedStylobateFloors(stylo);
      } catch (e) { console.error(e); }
    };
    loadLinked();
    return () => { cancelled = true; };
  }, [building, buildingDetails, currentBlock]);

  const linkedStylobateFloorIds = useMemo(() => linkedStylobateFloors.map(f => f.id), [linkedStylobateFloors]);

  const { entrances, matrixMap } = useDirectMatrix(currentBlock?.id);
  const { units, upsertUnit, batchUpsertUnits, isLoading: isUnitsLoading } = useDirectUnits(currentBlock?.id, linkedStylobateFloorIds);

  const displayFloors = useMemo(() => {
    const all = [...(rawFloors || []), ...linkedStylobateFloors];
    const unique = Array.from(new Map(all.map(f => [f.id, f])).values());
    return unique
      .filter(f => !f.isStylobate && !f.flags?.isStylobate)
      .filter(f => f.isDuplex || entrances.some(e => (parseInt(matrixMap[`${f.id}_${e.number}`]?.apts || 0) > 0)))
      .sort((a, b) => (Number(b.index) || 0) - (Number(a.index) || 0));
  }, [rawFloors, linkedStylobateFloors, entrances, matrixMap]);

  const { gridMap, generateInitialUnits, prepareResetPayload } = useMatrixData(units, displayFloors, entrances, matrixMap);

  const [editingUnit, setEditingUnit] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [confirmDuplexFloor, setConfirmDuplexFloor] = useState(null); 
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // [NEW] Состояние сохранения шага
  const [startNum, setStartNum] = useState(1);

  useEffect(() => {
    if (isUnitsLoading || !currentBlock || isReadOnly) return;
    if (units.length === 0 && entrances.length > 0 && displayFloors.length > 0) {
       const hasPlannedApts = Object.values(matrixMap).some(v => parseInt(v.apts) > 0);
       if (hasPlannedApts) {
          setIsGenerating(true);
          const initialUnits = generateInitialUnits(1);
          batchUpsertUnits(initialUnits)
            .then(() => {
                toast.success(`Сгенерировано ${initialUnits.length} помещений`);
                setIsGenerating(false);
            })
            .catch(e => {
                console.error(e);
                toast.error('Ошибка генерации');
                setIsGenerating(false);
            });
       }
    }
  }, [isUnitsLoading, units.length, currentBlock, isReadOnly, entrances.length, displayFloors.length]); 

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

    const duplicate = units.find(u => 
        String(u.num).trim().toLowerCase() === targetNum && 
        u.id !== editingUnit.id
    );

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

  // [UPDATED] Сохранение прогресса и выход
  const handleSaveStep = async () => {
      setIsSaving(true);
      try {
        await saveStepBuildingStatuses({ stepId: 'apartments', buildingId: building.id });
        toast.success('Конфигурация квартир сохранена');
        onBack(); // Возврат к списку
      } catch (e) {
        console.error(e);
        toast.error('Ошибка при сохранении статуса');
      } finally {
        setIsSaving(false);
      }
  };

  const colWidths = useMemo(() => {
    const widths = {};
    entrances.forEach(e => {
      let maxCount = 0;
      displayFloors.forEach(f => {
        const matrixKey = `${f.id}_${e.number}`;
        const count = parseInt(matrixMap[matrixKey]?.apts || 0);
        if (count > maxCount) maxCount = count;
      });
      const CELL_WIDTH = 58; 
      const GAP = 4;
      const PADDING = 16;
      widths[e.id] = Math.max(80, maxCount * CELL_WIDTH + (maxCount - 1) * GAP + PADDING);
    });
    return widths;
  }, [entrances, displayFloors, matrixMap]);

  if (!building || !currentBlock) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;

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
        saveDisabled={isReadOnly || isGenerating || isSaving} // Блокируем при сохранении
        saveLabel={isSaving ? 'Сохранение...' : 'Сохранить и выйти'}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl shadow-inner border border-slate-700 custom-scrollbar overflow-x-auto max-w-[50%]">
          {building.blocks.map((b, i) => (
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
                disabled={isReadOnly}
                type="number"
                className={`w-12 bg-transparent font-bold text-sm text-slate-700 outline-none text-center ${isReadOnly ? 'opacity-50' : ''}`}
                value={startNum}
                onChange={e => setStartNum(parseInt(e.target.value) || 1)}
              />
           </div>

           <Button 
              variant="destructive"
              onClick={() => setShowResetModal(true)}
              disabled={isReadOnly || isGenerating}
              className="h-10 px-4 shadow-red-100 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700"
           >
              <Eraser size={16} className="mr-2" />
              Сброс
           </Button>
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
                {entrances.map(e => (
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

                    {entrances.map((e) => {
                      const cellUnits = gridMap[f.id]?.[e.id] || [];
                      const isEvenCol = e.number % 2 === 0;
                      const bgColor = isEvenCol ? 'bg-slate-50/30' : 'bg-white';

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

      {/* MODAL: Confirm Floor Duplex Update */}
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