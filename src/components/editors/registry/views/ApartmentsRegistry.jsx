import React, { useState, useMemo, useRef } from 'react';
import { Home, Layers, CheckCircle2, Loader2, Search } from 'lucide-react';
import { Card, DebouncedInput, Select } from '@components/ui/UIKit';
import { useDirectIntegration } from '@hooks/api/useDirectIntegration';
import { useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import ApartmentInventoryModal from '../modals/ApartmentInventoryModal';

const getTypeConfig = type => {
  switch (type) {
    case 'flat':
      return { label: 'Квартира', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Home };
    case 'duplex_up':
      return {
        label: 'Дуплекс (В)',
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: Layers,
      };
    case 'duplex_down':
      return {
        label: 'Дуплекс (Н)',
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: Layers,
      };
    default:
      return { label: type, color: 'bg-slate-100 text-slate-600', icon: Home };
  }
};

const ApartmentsRegistry = ({ onSaveUnit, projectId }) => {
  const queryClient = useQueryClient();
  const { fullRegistry, loadingRegistry } = useDirectIntegration(projectId);
  const tableContainerRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingUnit, setEditingUnit] = useState(null);
  const [filters, setFilters] = useState({
    building: 'all',
    entrance: 'all',
    floor: 'all',
  });

  const { data, stats, filterOptions } = useMemo(() => {
    if (!fullRegistry || !fullRegistry.units) {
      return { data: [], stats: null, filterOptions: { buildings: [], entrances: [], floors: [] } };
    }

    const { units, buildings = [], floors = [], blocks = [], entrances = [] } = fullRegistry;

    const bMap = {};
    buildings.forEach(b => {
      bMap[b.id] = b;
    });
    const blMap = {};
    blocks.forEach(b => {
      blMap[b.id] = b;
    });
    const fMap = {};
    floors.forEach(f => {
      fMap[f.id] = f;
    });
    const eMap = {};
    entrances.forEach(e => {
      eMap[e.id] = e;
    });

    const apartments = units.filter(u => ['flat', 'duplex_up', 'duplex_down'].includes(u.type));

    const enriched = apartments.map(u => {
      const floor = fMap[u.floorId];
      const block = floor ? blMap[floor.blockId] : null;
      const building = block ? bMap[block.buildingId] : null;
      const entrance = u.entranceId ? eMap[u.entranceId]?.number : null;

      return {
        ...u,
        floorLabel: floor?.label || '-',
        blockLabel: block?.tabLabel || block?.label || '-',
        buildingLabel: building?.label || '-',
        houseNumber: building?.houseNumber || '-',
        buildingId: building?.id || null,
        entrance: entrance ?? '-',
      };
    });

    const searched = enriched.filter(item => {
      if (!searchTerm) return true;
      const low = searchTerm.toLowerCase();
      return String(item.number || '')
        .toLowerCase()
        .includes(low);
    });

    const filtered = searched.filter(item => {
      const byBuilding = filters.building === 'all' || item.buildingId === filters.building;
      const byEntrance =
        filters.entrance === 'all' || String(item.entrance) === String(filters.entrance);
      const byFloor = filters.floor === 'all' || String(item.floorLabel) === String(filters.floor);
      return byBuilding && byEntrance && byFloor;
    });

    const totalArea = filtered.reduce((sum, item) => sum + (parseFloat(item.area) || 0), 0);
    const totalLiving = filtered.reduce((sum, item) => sum + (parseFloat(item.livingArea) || 0), 0);

    const buildingOptions = buildings
      .map(b => ({
        value: b.id,
        label: `Дом ${b.houseNumber || '-'} (${b.label || 'Без названия'})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

    const context =
      filters.building === 'all'
        ? searched
        : searched.filter(x => x.buildingId === filters.building);

    const entranceOptions = Array.from(
      new Set(context.map(x => x.entrance).filter(v => v !== '-' && v !== null))
    )
      .sort((a, b) => Number(a) - Number(b))
      .map(v => ({ value: String(v), label: `Подъезд ${v}` }));

    const floorOptions = Array.from(
      new Set(context.map(x => x.floorLabel).filter(v => v && v !== '-'))
    )
      .sort((a, b) => String(a).localeCompare(String(b), 'ru', { numeric: true }))
      .map(v => ({ value: String(v), label: `Этаж ${v}` }));

    return {
      data: filtered.sort((a, b) =>
        String(a.number).localeCompare(String(b.number), 'ru', { numeric: true })
      ),
      stats: {
        count: filtered.length,
        area: totalArea,
        livingArea: totalLiving,
      },
      filterOptions: {
        buildings: buildingOptions,
        entrances: entranceOptions,
        floors: floorOptions,
      },
    };
  }, [fullRegistry, searchTerm, filters]);

  // Virtualization для больших списков
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60, // средняя высота строки в пикселях
    overscan: 10, // рендерить дополнительно 10 строк сверху и снизу
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
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold uppercase">Всего квартир</div>
          <div className="text-2xl font-black text-slate-800">{stats?.count || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold uppercase">Общая площадь</div>
          <div className="text-2xl font-black text-blue-600">
            {stats?.area?.toFixed(1) || 0} <span className="text-sm text-slate-400">м²</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-500 font-bold uppercase">Жилая площадь</div>
          <div className="text-2xl font-black text-emerald-600">
            {stats?.livingArea?.toFixed(1) || 0} <span className="text-sm text-slate-400">м²</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <DebouncedInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Поиск по номеру квартиры..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none"
          />
        </div>

        <Select
          value={filters.building}
          onChange={e =>
            setFilters(p => ({ ...p, building: e.target.value, entrance: 'all', floor: 'all' }))
          }
        >
          <option value="all">Все дома</option>
          {filterOptions.buildings.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          value={filters.entrance}
          onChange={e => setFilters(p => ({ ...p, entrance: e.target.value }))}
        >
          <option value="all">Все подъезды</option>
          {filterOptions.entrances.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          value={filters.floor}
          onChange={e => setFilters(p => ({ ...p, floor: e.target.value }))}
        >
          <option value="all">Все этажи</option>
          {filterOptions.floors.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
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
                <th className="p-4 text-xs">Секция / Этаж</th>
                <th className="p-4 text-center">Комнат</th>
                <th className="p-4 text-right bg-slate-700/50 text-emerald-300 border-l border-slate-700">
                  Общая (м²)
                </th>
                <th className="p-4 text-right border-l border-slate-700">Жилая (м²)</th>
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
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-black text-slate-800 text-lg">{item.number}</span>
                          {item.unitCode && (
                            <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              {item.unitCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${typeConf.color}`}
                        >
                          <TypeIcon size={12} /> {typeConf.label}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col text-xs">
                          <span className="font-bold text-slate-700">{item.blockLabel}</span>
                          <span className="text-slate-500">{item.floorLabel}</span>
                        </div>
                      </td>

                      <td className="p-4 text-center text-slate-700 font-medium">
                        {item.rooms ?? 0}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-800 bg-emerald-50/30 border-l border-emerald-100/50">
                        {(parseFloat(item.area) || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-600 border-l border-slate-100">
                        {(parseFloat(item.livingArea) || 0) > 0
                          ? (parseFloat(item.livingArea) || 0).toFixed(2)
                          : '-'}
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
        <ApartmentInventoryModal
          unit={editingUnit}
          unitsList={fullRegistry?.units || []}
          buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
          onClose={() => setEditingUnit(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default React.memo(ApartmentsRegistry);
