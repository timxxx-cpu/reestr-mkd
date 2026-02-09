import React, { useState, useMemo, useRef } from 'react';
import {
  Briefcase,
  FileText,
  Building2,
  School,
  CheckCircle2,
  Loader2,
  Search,
} from 'lucide-react';
import { Card, DebouncedInput } from '@components/ui/UIKit';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import CommercialInventoryModal from '../modals/CommercialInventoryModal';

const getTypeConfig = type => {
  switch (type) {
    case 'office':
      return {
        label: 'Офис',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: Briefcase,
      };
    case 'office_inventory':
      return {
        label: 'Нежилое (Инв.)',
        color: 'bg-teal-50 text-teal-700 border-teal-200',
        icon: FileText,
      };
    case 'non_res_block':
      return {
        label: 'Нежилой блок',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Building2,
      };
    case 'infrastructure':
      return {
        label: 'Инфраструктура',
        color: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: School,
      };
    case 'pantry':
      return {
        label: 'Кладовая',
        color: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: FileText,
      };
    default:
      return { label: type, color: 'bg-slate-100 text-slate-600', icon: FileText };
  }
};

const COMMERCIAL_TYPES = new Set([
  'office',
  'office_inventory',
  'non_res_block',
  'infrastructure',
  'pantry',
]);

const CommercialRegistry = ({ onSaveUnit, projectId }) => {
  const queryClient = useQueryClient();
  // Читаем данные из БД
  const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);
  const tableContainerRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingUnit, setEditingUnit] = useState(null);

  const { data, stats } = useMemo(() => {
    if (!fullRegistry || !fullRegistry.units) return { data: [], stats: null };

    const { units, buildings, floors, blocks } = fullRegistry;

    const bMap = {};
    buildings.forEach(b => (bMap[b.id] = b));
    const blMap = {};
    blocks.forEach(b => (blMap[b.id] = b));
    const fMap = {};
    floors.forEach(f => (fMap[f.id] = f));

    // 1. Обогащаем и определяем коммерческие объекты через контекст,
    // даже если unit_type заполнен неконсистентно.
    const enriched = units.map(u => {
      const floor = fMap[u.floorId];
      const block = floor ? blMap[floor.blockId] : null;
      const building = block ? bMap[block.buildingId] : null;

      const isCommercialByContext =
        COMMERCIAL_TYPES.has(u.type) ||
        block?.type === 'Н' ||
        block?.type === 'non_residential' ||
        building?.category === 'infrastructure' ||
        floor?.floor_type === 'office' ||
        floor?.is_commercial === true;

      return {
        ...u,
        type: u.type || (isCommercialByContext ? 'office' : 'flat'),
        isCommercialByContext,
        floorLabel: floor?.label || '-',
        blockLabel: block?.tabLabel || block?.label || '-',
        buildingLabel: building?.label || '-',
        houseNumber: building?.houseNumber || '-',
        entrance: u.entranceId ? '?' : '-',
      };
    });

    // 2. Фильтруем только нежилые
    const commercial = enriched.filter(item => item.isCommercialByContext);

    // 3. Поиск
    const filtered = commercial.filter(item => {
      if (!searchTerm) return true;
      const low = searchTerm.toLowerCase();
      return String(item.number || item.num || '')
        .toLowerCase()
        .includes(low);
    });

    // 4. Статистика
    const totalArea = filtered.reduce((sum, item) => sum + (parseFloat(item.area) || 0), 0);

    return {
      data: filtered.sort((a, b) => String(a.number).localeCompare(String(b.number))),
      stats: {
        count: filtered.length,
        area: totalArea,
      },
    };
  }, [fullRegistry, searchTerm]);

  // Virtualization для больших списков
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const handleSave = async changes => {
    const success = await onSaveUnit(editingUnit, changes);
    if (success) {
      setEditingUnit(null);
      queryClient.invalidateQueries({ queryKey: ['project-registry'] });
    }
  };

  if (loadingRegistry)
    return (
      <div className="p-12 text-center">
        <Loader2 className="animate-spin mx-auto text-blue-600" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold uppercase">Всего помещений</div>
          <div className="text-2xl font-black text-slate-800">{stats?.count || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold uppercase">Общая площадь</div>
          <div className="text-2xl font-black text-emerald-600">
            {stats?.area?.toFixed(1) || 0} <span className="text-sm text-slate-400">м²</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <DebouncedInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Поиск по номеру помещения..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 rounded-xl mx-4 md:mx-0">
        <div ref={tableContainerRef} className="overflow-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800 text-slate-200 border-b border-slate-700 text-[10px] uppercase font-bold sticky top-0 z-20 shadow-md">
              <tr>
                <th className="p-4 w-12 text-center text-slate-400">№</th>
                <th className="p-4 w-20 text-center">Дом</th>
                <th className="p-4 w-20 text-center border-l border-slate-700">Подъезд</th>
                <th className="p-4 w-32 text-center border-l border-slate-700">Номер</th>
                <th className="p-4 border-l border-slate-700">Тип</th>
                <th className="p-4">Секция</th>
                <th className="p-4 text-center">Этаж</th>
                <th className="p-4 text-right bg-slate-700/50 text-emerald-300 border-l border-slate-700">
                  Общая (м²)
                </th>
                <th className="p-4 text-right border-l border-slate-700">Основная (м²)</th>
                <th className="p-4 text-center border-l border-slate-700">Статус</th>
              </tr>
            </thead>
            <tbody
              className="bg-white text-sm"
              style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
            >
              {data.length > 0 ? (
                rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const item = data[virtualRow.index];
                  const typeConf = getTypeConfig(item.type);
                  const TypeIcon = typeConf.icon;
                  const isFilled = parseFloat(item.area) > 0;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setEditingUnit(item)}
                      className="group cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-100 even:bg-slate-50/50"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <td className="p-4 text-xs text-slate-400 text-center font-mono">
                        {virtualRow.index + 1}
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-white border border-slate-200 font-bold text-slate-700 text-xs shadow-sm">
                          {item.houseNumber}
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-500 border-l border-slate-100">
                        {item.entrance}
                      </td>
                      <td className="p-4 text-center relative border-x border-blue-100 bg-blue-50/20 group-hover:bg-blue-100/50 transition-colors">
                        <span className="font-black text-slate-800 text-lg">{item.number}</span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${typeConf.color}`}
                        >
                          <TypeIcon size={12} /> {typeConf.label}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        <span className="font-bold text-slate-700">{item.blockLabel}</span>
                      </td>
                      <td className="p-4 text-center font-medium text-slate-700">
                        {item.floorLabel}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-800 bg-emerald-50/30 border-l border-emerald-100/50">
                        {parseFloat(item.area).toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-600 border-l border-slate-100">
                        {item.mainArea ? parseFloat(item.mainArea).toFixed(2) : '-'}
                      </td>
                      <td className="p-4 text-center border-l border-slate-100">
                        {isFilled ? (
                          <div className="inline-flex items-center gap-1.5 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <span>Готов</span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">
                            Не заполнен
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400">
                    Нет объектов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editingUnit && (
        <CommercialInventoryModal
          unit={editingUnit}
          // Передаем полный список для копирования
          unitsList={fullRegistry?.units || []}
          buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
          onClose={() => setEditingUnit(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default React.memo(CommercialRegistry);
