import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Wand2,
  AlertTriangle,
  CheckSquare,
  Square,
  CheckCircle2,
  MousePointer2,
  X,
  Building2,
  Car,
  Box,
  Store,
  LayoutGrid,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useDirectFloors } from '@hooks/api/useDirectFloors';
import { useDirectMatrix } from '@hooks/api/useDirectMatrix'; // [NEW] Для структуры подъездов
import { useDirectUnits } from '@hooks/api/useDirectUnits'; // [NEW] Для данных квартир
import { useBuildingType } from '@hooks/useBuildingType';
import { Card, DebouncedInput, useReadOnly } from '@components/ui/UIKit';
import { UnitSchema } from '@lib/schemas';
import { ApiService } from '@lib/api-service';
import ConfigHeader from './configurator/ConfigHeader';
import { formatBlockSwitcherLabel } from '@lib/building-details';

const TYPE_COLORS = {
  flat: 'bg-white border-slate-200 hover:border-blue-300 shadow-sm',
  office: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  pantry: 'bg-slate-50 border-slate-200 text-slate-500',
  duplex_up: 'bg-purple-50 border-purple-200 text-purple-700',
  duplex_down: 'bg-orange-50 border-orange-200 text-orange-700',
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

  // 1. Context & Building
  const { buildings } = useDirectBuildings(projectId);
  const building = useMemo(() => buildings.find(b => b.id === buildingId), [buildings, buildingId]);
  const typeInfo = useBuildingType(building);
  const { isParking, isInfrastructure, isUnderground } = typeInfo;

  // 2. Block Management
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const currentBlock = useMemo(
    () => building?.blocks?.[activeBlockIndex],
    [building, activeBlockIndex]
  );

  // 3. Hooks Data
  const { floors: rawFloors } = useDirectFloors(currentBlock?.id);
  const [linkedStylobateFloors, setLinkedStylobateFloors] = useState([]);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

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
        console.error('Failed to load linked stylobate floors for apartments', e);
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
  const { units, upsertUnit, batchUpsertUnits } = useDirectUnits(
    currentBlock?.id,
    linkedStylobateFloorIds
  );

  // 4. Local State
  const [startNum, setStartNum] = useState(1);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const inputsRef = useRef({});
  const draftUnitIdsRef = useRef({});

  useEffect(() => {
    setSelectedIds(new Set());
    inputsRef.current = {};
    draftUnitIdsRef.current = {};
  }, [activeBlockIndex]);

  // 5. Data Processing

  // Фильтруем этажи, на которых есть квартиры (согласно матрице подъездов)
  // ИЛИ этажи, которые являются дуплексными

  const handleSaveStepStatus = async () => {
    if (!building || isReadOnly) return;
    try {
      setIsSavingStatus(true);
      await saveStepBuildingStatuses({ stepId: 'apartments', buildingId: building.id });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const floors = useMemo(() => {
    const mergedFloors = [...(rawFloors || []), ...linkedStylobateFloors];
    const uniqueFloors = Array.from(new Map(mergedFloors.map(floor => [floor.id, floor])).values());

    return uniqueFloors
      .filter(floor => !floor?.isStylobate && !floor?.flags?.isStylobate)
      .filter(floor => {
        // Если этаж дуплексный - показываем
        if (floor.isDuplex) return true;
        // Иначе проверяем, есть ли там квартиры по матрице
        return entrances.some(e => {
          const matrixKey = `${floor.id}_${e.number}`;
          const count = matrixMap[matrixKey]?.apts || 0;
          return count > 0;
        });
      })
      .sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));
  }, [rawFloors, linkedStylobateFloors, entrances, matrixMap]);

  // Маппинг юнитов для быстрого доступа: [floorId][entranceId][index] -> Unit
  // ВАЖНО: В БД юниты не имеют "индекса на площадке". Нам нужно их отсортировать (по номеру) и сопоставить.
  const gridMap = useMemo(() => {
    const map = {};
    units.forEach(u => {
      if (!map[u.floorId]) map[u.floorId] = {};
      if (!map[u.floorId][u.entranceId]) map[u.floorId][u.entranceId] = [];
      map[u.floorId][u.entranceId].push(u);
    });

    // ВАЖНО: не сортируем по номеру квартиры.
    // Номер меняется во время ввода, и сортировка приводит к "прыжкам" позиций
    // (одна и та же визуальная ячейка начинает ссылаться на другой unit).
    // Сохраняем стабильный порядок, пришедший из API (ordered by created_at).
    return map;
  }, [units]);

  // Расчет ширины колонок
  const colWidths = useMemo(() => {
    const widths = {};
    entrances.forEach(e => {
      let maxCount = 0;
      floors.forEach(f => {
        const matrixKey = `${f.id}_${e.number}`;
        const count = parseInt(matrixMap[matrixKey]?.apts || 0);
        if (count > maxCount) maxCount = count;
      });

      const CELL_WIDTH = 68;
      const GAP = 8;
      const PADDING = 24;

      if (maxCount === 0) widths[e.id] = 100;
      else widths[e.id] = maxCount * CELL_WIDTH + (maxCount - 1) * GAP + PADDING + 2;
    });
    return widths;
  }, [entrances, floors, matrixMap]);

  // Дубликаты
  const duplicateSet = useMemo(() => {
    const counts = {};
    const dups = new Set();
    units.forEach(u => {
      const num = String(u.num || '').trim();
      if (num) counts[num] = (counts[num] || 0) + 1;
    });
    Object.entries(counts).forEach(([num, count]) => {
      if (count > 1) dups.add(num);
    });
    return dups;
  }, [units]);

  // --- Actions ---

  // Получить юнит для ячейки. Если его нет в `units`, возвращаем заглушку.
  // При изменении заглушки она сохранится в БД.
  const getUnitForCell = (floorId, entranceId, index) => {
    const existingList = gridMap[floorId]?.[entranceId] || [];
    // Если юнит существует, возвращаем его
    if (existingList[index]) return existingList[index];

    // Если нет - возвращаем пустой шаблон
    return {
      id: null, // ID будет создан при сохранении
      num: '',
      type: 'flat',
      floorId,
      entranceId,
    };
  };

  const updateApt = (floorId, entranceId, index, field, val) => {
    if (isReadOnly) return;
    const currentUnit = getUnitForCell(floorId, entranceId, index);
    const draftKey = `${floorId}_${entranceId}_${index}`;
    const stableDraftId = draftUnitIdsRef.current[draftKey] || crypto.randomUUID();
    draftUnitIdsRef.current[draftKey] = stableDraftId;

    const newData = {
      ...currentUnit,
      id: currentUnit.id || stableDraftId,
      [field]: val,
    };

    upsertUnit(newData);
  };

  const _handleKeyDown = (e, _fIdx, _entIdxInArray, _idx) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    // Логика навигации (упрощена, т.к. требует точного знания DOM ref-ов)
    // В рамках рефакторинга можно пока пропустить сложную навигацию по стрелкам,
    // или восстановить позже, если критично.
  };

  const toggleSelection = unit => {
    if (isReadOnly) return;
    // Для выделения нам нужен ID. Если это виртуальный юнит, мы не можем его выделить надежно.
    // Поэтому выделяем только существующие или создаем временный ключ
    const key = unit.id || `${unit.floorId}_${unit.entranceId}_${unit.num}_temp`;

    const newSet = new Set(selectedIds);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedIds(newSet);
  };

  const applyBulkType = async type => {
    if (isReadOnly) return;

    // Находим все выбранные юниты из `units`
    const toUpdate = units.filter(u => selectedIds.has(u.id));

    // Массово обновляем
    const payload = toUpdate.map(u => ({ ...u, type }));
    if (payload.length > 0) {
      await batchUpsertUnits(payload);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const autoNumber = async () => {
    if (isReadOnly) return;
    let n = startNum;
    const toCreate = [];

    // Проходим строго по порядку: Подъезд -> Этаж -> Индекс
    // ВАЖНО: Мы должны уважать `entrance_matrix` (кол-во квартир)
    for (const e of entrances) {
      for (const f of floors) {
        const matrixKey = `${f.id}_${e.number}`;
        const count = parseInt(matrixMap[matrixKey]?.apts || 0);

        // Получаем существующие юниты, чтобы перезаписать их номера
        // Или создаем новые заглушки
        const existingList = gridMap[f.id]?.[e.id] || [];

        for (let i = 0; i < count; i++) {
          const existing = existingList[i];
          // Пропускаем нежилые типы при нумерации квартир
          if (existing && !['flat', 'duplex_up', 'duplex_down'].includes(existing.type)) continue;

          const draftKey = `${f.id}_${e.id}_${i}`;
          const stableDraftId = draftUnitIdsRef.current[draftKey] || crypto.randomUUID();
          draftUnitIdsRef.current[draftKey] = stableDraftId;

          const unitData = existing || {
            id: stableDraftId,
            floorId: f.id,
            entranceId: e.id,
            type: 'flat',
          };

          toCreate.push({
            ...unitData,
            num: String(n++),
          });
        }
      }
    }

    if (toCreate.length > 0) {
      await batchUpsertUnits(toCreate);
    }
  };

  const isFloorDuplexValid = floorId => {
    // Проверка: если этаж дуплексный, есть ли на нем дуплекс-юниты?
    const floor = rawFloors.find(f => f.id === floorId);
    if (!floor?.isDuplex) return true;

    // Ищем хоть один юнит типа duplex
    const hasDuplex = units.some(
      u => u.floorId === floorId && (u.type === 'duplex_up' || u.type === 'duplex_down')
    );
    return hasDuplex;
  };

  if (!building) return <div className="p-12 text-center text-slate-500">Загрузка...</div>;
  if (!currentBlock) return <div className="p-12 text-center text-slate-500">Блоки не найдены</div>;

  return (
    <div className="space-y-6 pb-24 w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto animate-in fade-in duration-500 relative">
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
        saveLabel={isSavingStatus ? 'Сохраняем…' : 'Сохранить'}
      />

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-max overflow-x-auto max-w-full shadow-inner border border-slate-700 custom-scrollbar">
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

        <div className="flex gap-3">
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

          <button
            disabled={isReadOnly}
            onClick={autoNumber}
            className={`px-4 py-2 bg-purple-50 text-purple-600 border-purple-100 border rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-sm ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-100'}`}
          >
            <Wand2 size={14} /> Авто-нум.
          </button>

          <button
            disabled={isReadOnly}
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedIds(new Set());
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-sm ${isSelectionMode ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSelectionMode ? <CheckSquare size={14} /> : <MousePointer2 size={14} />}
            {isSelectionMode ? 'Режим выделения' : 'Выделение'}
          </button>
        </div>
      </div>

      {/* Selection Toolbar */}
      {selectedIds.size > 0 && !isReadOnly && (
        <div className="sticky top-4 z-50 mb-4 mx-auto max-w-xl animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-slate-900/95 backdrop-blur text-white p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 ring-1 ring-white/10">
            <div className="bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-sm">
              <CheckCircle2 size={14} className="text-white/80" />
              {selectedIds.size}
            </div>
            <div className="h-6 w-px bg-white/10"></div>
            <div className="flex gap-1">
              <button
                onClick={() => applyBulkType('duplex_up')}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold transition-colors"
              >
                Дуплекс
              </button>
              <button
                onClick={() => applyBulkType('office')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-colors"
              >
                Офис
              </button>
              <button
                onClick={() => applyBulkType('flat')}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition-colors"
              >
                Квартира
              </button>
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className="shadow-lg border-0 ring-1 ring-slate-200 rounded-xl overflow-hidden flex flex-col h-full bg-white max-w-full">
        <div
          className="flex-1 overflow-x-auto overflow-y-auto w-full max-w-full relative"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
        >
          <table className="border-collapse bg-white w-max">
            <thead className="sticky top-0 z-30 shadow-md">
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                <th className="p-3 sticky left-0 z-40 bg-slate-100 border-r-2 border-slate-300 w-20 min-w-[80px] text-center shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] text-xs font-black text-slate-600 uppercase tracking-wider">
                  Этаж
                </th>
                {entrances.map(e => (
                  <th
                    key={e.id}
                    className="p-3 border-r-2 border-slate-300/50 bg-slate-50 text-center"
                    style={{ width: colWidths[e.id], minWidth: colWidths[e.id] }}
                  >
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Подъезд
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm font-black text-slate-700 shadow-sm">
                        {e.number}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {floors.map(f => {
                const isValid = isFloorDuplexValid(f.id);

                return (
                  <tr
                    key={f.id}
                    className={`${f.isDuplex ? 'bg-purple-50/10' : 'bg-white'} hover:bg-slate-50 transition-colors h-auto`}
                  >
                    <td
                      className={`p-3 font-bold text-sm sticky left-0 border-r-2 border-slate-300 text-center z-20 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)] ${!isValid ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'}`}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        {f.label}
                        {f.isDuplex && (
                          <div
                            title={
                              !isValid
                                ? 'На дуплексном этаже должна быть хоть одна дуплексная квартира'
                                : 'Дуплексный этаж'
                            }
                            className="mt-1"
                          >
                            {!isValid ? (
                              <AlertTriangle size={14} className="text-red-500" />
                            ) : (
                              <Layers size={14} className="text-purple-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {entrances.map(e => {
                      // Получаем количество из матрицы
                      const matrixKey = `${f.id}_${e.number}`;
                      const count = parseInt(matrixMap[matrixKey]?.apts || 0);
                      const isEvenCol = e.number % 2 === 0;
                      const bgColor = isEvenCol ? 'bg-slate-50/50' : 'bg-white';

                      if (count === 0)
                        return (
                          <td
                            key={e.id}
                            className={`p-3 border-r-2 border-slate-300/50 ${bgColor}`}
                            style={{ width: colWidths[e.id], minWidth: colWidths[e.id] }}
                          ></td>
                        );

                      return (
                        <td
                          key={e.id}
                          className={`p-3 border-r-2 border-slate-300/50 align-top ${bgColor}`}
                          style={{ width: colWidths[e.id], minWidth: colWidths[e.id] }}
                        >
                          <div className="flex flex-wrap gap-2 content-start">
                            {Array.from({ length: count }).map((_, i) => {
                              const a = getUnitForCell(f.id, e.id, i);
                              // Используем ID, если есть, или временный ключ для selection
                              const cellKey = a.id || `${f.id}_${e.id}_${i}_unsaved`;
                              const isSelected = selectedIds.has(a.id || cellKey);
                              const isDuplicate = duplicateSet.has(a.num);
                              const isMissingNum = !a.num || String(a.num).trim() === '';

                              const result = UnitSchema.safeParse(a);
                              const isInvalidSchema = !result.success && !isMissingNum;

                              let borderColorClass = '';
                              if (isSelected)
                                borderColorClass =
                                  'border-blue-500 ring-2 ring-blue-200 bg-blue-50';
                              else if (isDuplicate)
                                borderColorClass = 'border-red-500 bg-red-50 shadow-red-100';
                              else if (isMissingNum)
                                borderColorClass =
                                  'border-amber-400 bg-amber-50 shadow-amber-100 border-dashed';
                              else if (isInvalidSchema)
                                borderColorClass = 'border-red-300 border-dashed bg-red-50/30';
                              else borderColorClass = TYPE_COLORS[a.type] || TYPE_COLORS.flat;

                              return (
                                <button
                                  key={cellKey}
                                  type="button"
                                  onClick={() =>
                                    isSelectionMode && !isReadOnly && toggleSelection(a)
                                  }
                                  disabled={!isSelectionMode || isReadOnly}
                                  className={`
                                                                        flex flex-col gap-1 p-1.5 border-2 rounded-lg w-[68px] text-center transition-all shadow-sm relative group
                                                                        ${borderColorClass}
                                                                        ${isSelectionMode && !isReadOnly ? 'cursor-pointer hover:border-blue-400' : ''}
                                                                    `}
                                >
                                  <div
                                    className={`h-1.5 w-full rounded-full ${a.type === 'office' ? 'bg-emerald-400' : a.type.includes('duplex') ? 'bg-purple-400' : 'bg-slate-200'}`}
                                  ></div>

                                  {isSelectionMode ? (
                                    <div
                                      className={`font-black text-sm py-1 ${isDuplicate ? 'text-red-600' : 'text-slate-700'}`}
                                    >
                                      {a.num || '-'}
                                    </div>
                                  ) : (
                                    <DebouncedInput
                                      // ref={el => inputsRef.current[`${e.id}-${f.id}-${i}`] = el}
                                      type="text"
                                      className={`w-full text-center font-black text-sm outline-none bg-transparent ${isDuplicate ? 'text-red-600' : isMissingNum ? 'placeholder:text-amber-400' : 'text-slate-700'} ${isReadOnly ? 'cursor-default' : ''}`}
                                      value={a.num}
                                      onChange={val => updateApt(f.id, e.id, i, 'num', val)}
                                      placeholder="№"
                                      disabled={isReadOnly}
                                    />
                                  )}

                                  {isDuplicate && (
                                    <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 z-20 shadow-sm ring-1 ring-white">
                                      <AlertCircle size={10} />
                                    </div>
                                  )}
                                  {isMissingNum && !isSelectionMode && (
                                    <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white rounded-full p-0.5 z-20 shadow-sm ring-1 ring-white">
                                      <AlertCircle size={10} />
                                    </div>
                                  )}

                                  {f.isDuplex && !isSelectionMode && (
                                    <select
                                      disabled={isReadOnly}
                                      className={`w-full text-[9px] bg-transparent outline-none font-bold text-center appearance-none border-t border-black/5 mt-0.5 pt-0.5 text-slate-500 uppercase tracking-tight ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:text-blue-600'}`}
                                      value={a.type}
                                      onChange={ev =>
                                        updateApt(f.id, e.id, i, 'type', ev.target.value)
                                      }
                                    >
                                      <option value="flat">Кв.</option>
                                      <option value="duplex_up">Верх</option>
                                      <option value="duplex_down">Низ</option>
                                    </select>
                                  )}
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
    </div>
  );
}
