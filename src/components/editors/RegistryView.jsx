import React, { useMemo } from 'react';
import {
  Printer,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Hash,
  Calendar,
  Building2,
  Warehouse,
  Loader2,
} from 'lucide-react';
import { useProject } from '@context/ProjectContext';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { Card, Badge } from '@components/ui/UIKit';
import { calculateProgress, getStageColor } from '@lib/utils';

/**
 * Агрегация статистики по блоку на основе плоских списков из БД
 */
const aggregateBlockStats = (building, block, allFloors, allUnits) => {
  const blockFloors = allFloors.filter(f => f.blockId === block.id);
  const floorIds = new Set(blockFloors.map(f => f.id));

  // Юниты, относящиеся к этому блоку (через этажи)
  const blockUnits = allUnits.filter(u => floorIds.has(u.floorId));

  const stats = {
    id: `${building.id}_${block.id}`,
    label: block.tabLabel || block.label,
    subLabel: building.label, // Для группировки
    category: building.category,

    floorsCount: blockFloors.length, // Или взять максимальный index
    areaProj: blockFloors.reduce((acc, f) => acc + (parseFloat(f.areaProj) || 0), 0),
    areaFact: blockFloors.reduce((acc, f) => acc + (parseFloat(f.areaFact) || 0), 0),

    cadastreNumber: building.cadastreNumber, // Кадастр здания
    stage: building.stage,
    dateStart: building.dateStart,
    dateEnd: building.dateEnd,

    units: {
      flats: 0,
      offices: 0,
      parking: 0,
      pantry: 0,
    },
  };

  blockUnits.forEach(u => {
    if (['flat', 'duplex_up', 'duplex_down'].includes(u.type)) stats.units.flats++;
    else if (['office', 'office_inventory', 'non_res_block', 'infrastructure'].includes(u.type))
      stats.units.offices++;
    else if (u.type === 'pantry') stats.units.pantry++;
    else if (u.type === 'parking_place') stats.units.parking++;
  });

  return stats;
};

const RegistryRow = ({ item, index }) => {
  const diff = item.areaFact - item.areaProj;
  const diffPercent = item.areaProj > 0 ? (diff / item.areaProj) * 100 : 0;
  const hasCriticalDiff = Math.abs(diffPercent) > 5;

  const isEmpty = item.areaProj === 0;
  const progress = calculateProgress(item.dateStart, item.dateEnd);

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 text-sm group">
      <td className="p-4 text-slate-400 text-center w-12 font-mono text-xs">{index + 1}</td>

      {/* Наименование */}
      <td className="p-4 min-w-[200px]">
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-sm">{item.subLabel}</span>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border border-slate-200">
              {item.label}
            </span>
          </div>
        </div>
      </td>

      {/* Кадастр и Статус */}
      <td className="p-4 w-[180px]">
        <div className="flex flex-col gap-1.5">
          {item.cadastreNumber ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-mono text-xs font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100 w-fit">
              <Hash size={10} /> {item.cadastreNumber}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs px-2 py-1">
              <Hash size={10} /> <span>Не присвоен</span>
            </div>
          )}
          <span
            className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase w-fit border ${getStageColor(item.stage)}`}
          >
            {item.stage || 'Проект'}
          </span>
        </div>
      </td>

      {/* Сроки */}
      <td className="p-4 w-[140px]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Calendar size={10} /> Срок:
            </span>
            <span>{item.dateEnd ? new Date(item.dateEnd).toLocaleDateString('ru-RU') : '-'}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-[9px] text-right font-bold text-slate-400">
            {Math.round(progress)}%
          </div>
        </div>
      </td>

      <td className="p-4 text-center">
        {isEmpty ? (
          <span className="text-slate-300">-</span>
        ) : (
          <span className="font-mono font-bold text-slate-600">{item.floorsCount}</span>
        )}
      </td>

      {/* Площади */}
      <td className="p-4 text-right font-mono text-slate-600 bg-slate-50/30 border-l border-slate-100">
        {item.areaProj > 0
          ? item.areaProj.toLocaleString(undefined, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })
          : '-'}
      </td>
      <td className="p-4 text-right font-mono border-r border-slate-100">
        {item.areaFact > 0 ? (
          <div className="flex flex-col items-end">
            <span
              className={hasCriticalDiff ? 'text-red-600 font-bold' : 'text-slate-700 font-bold'}
            >
              {item.areaFact.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
            {hasCriticalDiff && (
              <span className="text-[9px] text-red-500 flex items-center gap-1 bg-red-50 px-1 rounded mt-0.5">
                {diff > 0 ? '+' : ''}
                {diffPercent.toFixed(1)}% <AlertTriangle size={8} />
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-300">-</span>
        )}
      </td>

      {/* Детализация */}
      <td className="p-4">
        <div className="flex flex-wrap gap-1.5 justify-start">
          {item.units.flats > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
              {item.units.flats} кв
            </span>
          )}
          {item.units.offices > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
              {item.units.offices} оф
            </span>
          )}
          {item.units.parking > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
              {item.units.parking} мм
            </span>
          )}
          {item.units.pantry > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
              {item.units.pantry} кл
            </span>
          )}
          {Object.values(item.units).every(v => v === 0) && (
            <span className="text-slate-300 text-xs">-</span>
          )}
        </div>
      </td>

      <td className="p-4 text-center">
        {!isEmpty ? (
          <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
            <CheckCircle2 size={10} /> Готов
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
            <AlertTriangle size={10} /> Пусто
          </div>
        )}
      </td>
    </tr>
  );
};

export default function RegistryView({ mode = 'all' }) {
  const { projectId, complexInfo } = useProject();

  // [NEW] Загружаем полные данные через API (ReadOnly)
  const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);

  // Сбор данных
  const registryItems = useMemo(() => {
    if (!fullRegistry || !fullRegistry.buildings) return [];

    const items = [];
    const { buildings, blocks, floors, units } = fullRegistry;

    // Итерируемся по зданиям -> блокам
    buildings.forEach(building => {
      const buildingBlocks = blocks.filter(b => b.building_id === building.id);

      // Фильтрация по режиму (Жилье / Нежилье)
      if (mode === 'nonres') {
        // Инфраструктура
        if (building.category === 'infrastructure') {
          // Инфраструктура может не иметь блоков в БД, если создана упрощенно, но API createBuilding создает.
          // Если есть блок - используем его
          const mainBlock = buildingBlocks[0];
          if (mainBlock) {
            items.push(aggregateBlockStats(building, mainBlock, floors, units));
          }
        }
        // Коммерческие блоки в ЖК
        else if (building.category.includes('residential')) {
          buildingBlocks.forEach(b => {
            if (b.type === 'Н' || b.type === 'non_residential') {
              items.push(aggregateBlockStats(building, b, floors, units));
            }
          });
        }
      } else if (mode === 'res') {
        // Жилые блоки
        if (building.category.includes('residential')) {
          buildingBlocks.forEach(b => {
            if (b.type === 'Ж' || b.type === 'residential') {
              items.push(aggregateBlockStats(building, b, floors, units));
            }
          });
        }
        // Паркинги
        else if (building.category === 'parking_separate') {
          buildingBlocks.forEach(b => {
            items.push(aggregateBlockStats(building, b, floors, units));
          });
        }
      }
    });

    return items;
  }, [fullRegistry, mode]);

  const handlePrint = () => {
    window.print();
  };

  if (loadingRegistry) {
    return (
      <div className="p-20 flex justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (registryItems.length === 0) {
    return (
      <div className="w-full pb-20 space-y-6 animate-in fade-in duration-500 px-6">
        <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <Building2 className="mx-auto mb-3 opacity-50" size={48} />
          Список объектов пуст
        </div>
      </div>
    );
  }

  const title =
    mode === 'nonres' ? 'Сводная по нежилым блокам и инфраструктуре' : 'Сводная по жилому фонду';
  const subTitle =
    mode === 'nonres'
      ? 'Реестр социальных объектов и коммерческих блоков'
      : 'Реестр жилых корпусов и паркингов';
  const Icon = mode === 'nonres' ? Warehouse : Building2;

  // Итоговые суммы
  const totalProj = registryItems.reduce((acc, i) => acc + i.areaProj, 0);
  const totalFact = registryItems.reduce((acc, i) => acc + i.areaFact, 0);

  return (
    <div className="w-full pb-20 space-y-6 animate-in fade-in duration-500 px-6">
      {/* Header */}
      <div className="flex justify-between items-start md:items-center print:hidden border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-xl shadow-lg ${mode === 'nonres' ? 'bg-amber-500 text-white shadow-amber-200' : 'bg-blue-600 text-white shadow-blue-200'}`}
          >
            <Icon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            <p className="text-sm text-slate-500">{subTitle}</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700"
        >
          <Printer size={16} /> Печать
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
        <MapPin size={14} />
        <span>Объект:</span>
        <span className="font-bold text-slate-700">{complexInfo?.name || 'Без названия'}</span>
        <span className="mx-1">•</span>
        <span>{complexInfo?.street || 'Адрес не указан'}</span>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden shadow-sm border border-slate-200 print:shadow-none print:border-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th className="p-4 text-center">№</th>
                <th className="p-4">Наименование</th>
                <th className="p-4 w-[180px]">Кадастр / Статус</th>
                <th className="p-4 w-[140px]">Сроки</th>
                <th className="p-4 text-center">Этажность</th>
                <th className="p-4 text-right border-l border-slate-100">S Проект (м²)</th>
                <th className="p-4 text-right border-r border-slate-100">S Факт (м²)</th>
                <th className="p-4">Состав</th>
                <th className="p-4 text-center">Готовность</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {registryItems.map((item, idx) => (
                <RegistryRow key={item.id} item={item} index={idx} />
              ))}

              {/* Footer Row */}
              <tr className="bg-slate-100/50 font-bold text-sm text-slate-800 border-t-2 border-slate-200">
                <td
                  colSpan={5}
                  className="p-4 text-right uppercase tracking-wider text-xs text-slate-500"
                >
                  Общий итог по реестру:
                </td>
                <td className="p-4 text-right font-mono border-l border-slate-200 bg-white/50">
                  {totalProj.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className="p-4 text-right font-mono text-emerald-700 border-r border-slate-200 bg-white/50">
                  {totalFact.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
