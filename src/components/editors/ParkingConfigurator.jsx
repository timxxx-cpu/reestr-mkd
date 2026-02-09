import React, { useMemo } from 'react';
import {
  Save,
  Car,
  CheckCircle2,
  Loader2,
  ArrowDown,
  ArrowUp,
  ArrowDownToLine,
  Footprints,
  MapPin,
  Building2,
  X,
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectBuildings } from '@hooks/api/useDirectBuildings';
import { useDirectParking } from '@hooks/api/useDirectParking';
import { useDirectFloors } from '@hooks/api/useDirectFloors';
// [FIX] Добавлен DebouncedInput
import { Card, Button, Input, useReadOnly, Label, DebouncedInput } from '@components/ui/UIKit';
import { getBlocksList } from '@lib/utils';
import { ParkingLevelConfigSchema } from '@lib/schemas';

// Вспомогательный компонент для загрузки этажей блока
const ParkingRow = ({ row, isReadOnly, counts, basements, onToggle, onCountChange }) => {
  const { floors } = useDirectFloors(row.blockId);

  const floor = useMemo(() => {
    if (!floors) return null;
    if (row.isBasement) {
      const targetIndex = -row.depthLevel;
      return floors.find(f => f.index === targetIndex);
    } else {
      if (row.id.startsWith('floor_')) {
        const idx = parseInt(row.id.split('_')[1]);
        return floors.find(f => f.index === idx);
      }
      if (row.id.startsWith('level_minus_')) {
        const idx = -parseInt(row.id.split('_')[2]);
        return floors.find(f => f.index === idx);
      }
    }
    return null;
  }, [floors, row]);

  const isEnabled = useMemo(() => {
    if (row.isMandatory) return true;
    if (row.isBasement && row.basementId) {
      const base = basements.find(b => b.id === row.basementId);
      return base?.parkingLevels?.[row.depthLevel] || false;
    }
    return false;
  }, [row, basements]);

  const count = floor ? counts[floor.id] || '' : '';
  const validationResult = ParkingLevelConfigSchema.safeParse({ count });
  const isInvalid = !validationResult.success && count !== '' && count !== 0;

  const handleCountChange = val => {
    if (!floor) return;
    const num = parseInt(val) || 0;
    onCountChange({ floorId: floor.id, count: num, buildingId: row.buildingId });
  };

  const handleToggle = () => {
    if (!row.isBasement || isReadOnly) return;
    onToggle({ basementId: row.basementId, level: row.depthLevel, isEnabled: !isEnabled });
  };

  if (!floor && !row.isBasement) return null;

  return (
    <tr className={`transition-colors ${isEnabled ? 'bg-white' : 'bg-slate-50/50'}`}>
      <td className="p-4">
        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
          {row.houseNumber}
        </span>
      </td>
      <td className="p-4 text-sm font-bold text-slate-700">{row.buildingLabel}</td>
      <td className="p-4">
        <span className="text-xs font-medium text-slate-500">{row.blockLabel}</span>
      </td>
      <td className="p-4">
        <span
          className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${row.type === 'Подземный' ? 'bg-slate-800 text-white border-slate-800' : row.type === 'Подвал' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}
        >
          {row.type}
        </span>
      </td>
      <td className="p-4">
        <div className="flex flex-col">
          <span className={`font-bold text-sm ${isEnabled ? 'text-slate-800' : 'text-slate-400'}`}>
            {row.label}
          </span>
        </div>
      </td>

      <td className="p-4 text-center">
        <label
          className={`flex items-center justify-center group relative ${row.isMandatory || isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={isEnabled}
            disabled={row.isMandatory || isReadOnly}
            onChange={handleToggle}
          />
          {row.isMandatory ? (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
              <CheckCircle2 size={12} />
              <span>АКТИВЕН</span>
            </div>
          ) : (
            <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 relative"></div>
          )}
        </label>
      </td>

      <td className="p-4">
        <div
          className={`flex items-center gap-3 transition-opacity duration-200 ${isEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}
        >
          <div className="relative max-w-xs w-32">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Car size={14} className="text-slate-400" />
            </div>
            <DebouncedInput
              type="number"
              min="0"
              className={`pl-8 pr-3 py-2 w-full border rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all ${isInvalid ? 'border-red-500 bg-red-50' : 'border-slate-200'} ${isReadOnly ? 'bg-transparent border-transparent cursor-default' : ''}`}
              placeholder="0"
              value={count}
              onChange={handleCountChange}
              disabled={isReadOnly}
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">мест</span>
        </div>
      </td>
    </tr>
  );
};

export default function ParkingConfigurator({ buildingId }) {
  const { projectId } = useProject();
  const isReadOnly = useReadOnly();

  const { buildings, isLoading: loadingBuildings } = useDirectBuildings(projectId);
  const { basements, counts, toggleLevel, setPlacesCount, isMutating } =
    useDirectParking(projectId);

  const allRows = useMemo(() => {
    if (!buildings.length) return [];
    const rows = [];
    const targetBuildings = buildingId ? buildings.filter(b => b.id === buildingId) : buildings;

    targetBuildings.forEach(b => {
      if (b.category === 'infrastructure') return;
      const blocks = getBlocksList(b);

      blocks.forEach(block => {
        const isParkingBuilding = b.category === 'parking_separate';
        const commonData = {
          buildingId: b.id,
          buildingLabel: b.label,
          houseNumber: b.houseNumber,
          blockLabel: block.tabLabel,
          blockId: block.id,
        };

        if (isParkingBuilding) {
          const isUnderground = b.parkingType === 'underground';
          const floorsCount = block.floorsCount || 1;

          if (isUnderground) {
            for (let i = 1; i <= floorsCount; i++) {
              rows.push({
                ...commonData,
                id: `level_minus_${i}`,
                label: `Уровень -${i}`,
                type: 'Подземный',
                isMandatory: true,
                isBasement: false,
              });
            }
          } else {
            for (let i = 1; i <= floorsCount; i++) {
              rows.push({
                ...commonData,
                id: `floor_${i}`,
                label: `Этаж ${i}`,
                type: 'Наземный',
                isMandatory: true,
                isBasement: false,
              });
            }
            const blockBasements = basements.filter(base => base.blockId === block.id);
            blockBasements.forEach(base => {
              for (let d = 1; d <= base.depth; d++) {
                rows.push({
                  ...commonData,
                  id: `base_${base.id}_L${d}`,
                  label: `Подвал -${d}`,
                  type: 'Подвал',
                  basementId: base.id,
                  depthLevel: d,
                  isMandatory: true,
                  isBasement: true,
                });
              }
            });
          }
        } else {
          const blockBasements = basements.filter(base => base.blockId === block.id);
          blockBasements.forEach(base => {
            for (let d = 1; d <= base.depth; d++) {
              rows.push({
                ...commonData,
                id: `base_${base.id}_L${d}`,
                label: `Подвал -${d}`,
                type: 'Подвал',
                basementId: base.id,
                depthLevel: d,
                isMandatory: false,
                isBasement: true,
              });
            }
          });
        }
      });
    });
    return rows;
  }, [buildings, basements, buildingId]);

  if (loadingBuildings)
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500 px-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 leading-tight">
            Конфигурация паркингов
          </h2>
          <p className="text-slate-500 text-sm mt-1">Управление местами в паркингах и подвалах</p>
        </div>
        {isMutating && (
          <div className="text-blue-600 text-xs font-bold animate-pulse flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Сохранение...
          </div>
        )}
      </div>

      {allRows.length > 0 ? (
        <Card className="overflow-hidden shadow-lg border-0 ring-1 ring-slate-200 rounded-xl">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase">
              <tr>
                <th className="p-4 text-left w-[10%]">Дом</th>
                <th className="p-4 text-left w-[20%]">Здание</th>
                <th className="p-4 text-left w-[15%]">Блок</th>
                <th className="p-4 text-left w-[15%]">Тип</th>
                <th className="p-4 text-left w-[15%]">Уровень</th>
                <th className="p-4 text-center w-[10%]">Статус</th>
                <th className="p-4 text-left w-[15%]">Количество мест</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {allRows.map(row => (
                <ParkingRow
                  key={row.id + row.blockId}
                  row={row}
                  isReadOnly={isReadOnly}
                  counts={counts}
                  basements={basements}
                  onToggle={toggleLevel}
                  onCountChange={setPlacesCount}
                />
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <Car size={48} className="mx-auto mb-4 text-slate-300 opacity-50" />
          <p className="font-medium">Нет доступных уровней для паркинга.</p>
          <p className="text-xs mt-2 max-w-sm mx-auto">
            Убедитесь, что в проекте есть паркинги или жилые дома с подвалами.
          </p>
        </div>
      )}
    </div>
  );
}
