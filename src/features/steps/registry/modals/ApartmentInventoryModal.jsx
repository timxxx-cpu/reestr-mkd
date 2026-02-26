import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Plus, Copy } from 'lucide-react';
import { Input, Select, useReadOnly } from '@components/ui/UIKit';
import { useToast } from '@context/ToastContext';
import RegistryModalLayout, { StatBadge } from './RegistryModalLayout';
import { CatalogService } from '@lib/catalog-service';

const MEZZANINE_TYPES = [
  { value: 'internal', label: 'Внутренний' },
  { value: 'external', label: 'Внешний' },
];

export default function ApartmentInventoryModal({ unit, unitsList = [], buildingLabel, onClose, onSave }) {
  const isReadOnly = useReadOnly();
  const toast = useToast();

  const [rooms, setRooms] = useState(unit.explication || []);
  const [copySourceNum, setCopySourceNum] = useState('');
  const [hasMezzanine, setHasMezzanine] = useState(!!unit.hasMezzanine);
  const [mezzanineType, setMezzanineType] = useState(unit.mezzanineType || 'internal');

  useEffect(() => {
    setRooms(unit.explication || []);
    setCopySourceNum('');
    setHasMezzanine(!!unit.hasMezzanine);
    setMezzanineType(unit.mezzanineType || 'internal');
  }, [unit.id, unit.explication, unit.hasMezzanine, unit.mezzanineType]);

  const isDuplex = ['duplex_up', 'duplex_down'].includes(unit.type);

  const { data: roomTypesRows = [] } = useQuery({
    queryKey: ['catalog', 'dict_room_types', 'residential'],
    queryFn: () => CatalogService.getCatalog('dict_room_types'),
  });

  const residentialRoomTypes = useMemo(() => {
    const rows = (roomTypesRows || []).filter(r => r.room_scope === 'residential');
    return rows.map(r => ({
      id: r.code || r.id,
      label: r.label,
      k: Number(r.coefficient ?? r.k ?? 1),
      category: r.area_bucket || r.category || 'useful',
    }));
  }, [roomTypesRows]);

  const stats = useMemo(() => {
    let s_total = 0;
    let s_living = 0;
    let s_useful = 0;
    let count_living = 0;

    rooms.forEach(r => {
      const rawArea = parseFloat(r.area) || 0;
      const typeConfig = residentialRoomTypes.find(t => t.id === r.type) || { k: 1.0, category: 'useful' };
      const effectiveArea = rawArea * typeConfig.k;

      s_total += effectiveArea;

      if (typeConfig.category === 'living') {
        s_living += rawArea;
        count_living += 1;
      } else if (typeConfig.category === 'useful') {
        s_useful += rawArea;
      }
    });

    return {
      total: s_total.toFixed(2),
      living: s_living.toFixed(2),
      useful: s_useful.toFixed(2),
      living_rooms_count: count_living,
    };
  }, [rooms, residentialRoomTypes]);

  const addRoom = () => {
    if (isReadOnly || !residentialRoomTypes.length) return;
    setRooms([
      ...rooms,
      {
        id: crypto.randomUUID(),
        type: residentialRoomTypes[0].id,
        area: '',
        height: '',
        level: '1',
        isMezzanine: false,
        unitId: unit.id,
      },
    ]);
  };

  const removeRoom = id => {
    if (isReadOnly) return;
    setRooms(rooms.filter(r => r.id !== id));
  };

  const updateRoom = (id, field, value) => {
    if (isReadOnly) return;
    setRooms(rooms.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleCopy = () => {
    if (isReadOnly || !copySourceNum.trim()) return;

    const sourceUnit = unitsList.find(u => String(u.num) === String(copySourceNum) && u.id !== unit.id);

    if (!sourceUnit) {
      toast.error(`Квартира №${copySourceNum} не найдена в этом блоке`);
      return;
    }

    const sourceRooms = sourceUnit.explication;

    if (!sourceRooms || sourceRooms.length === 0) {
      toast.error(`Квартира №${copySourceNum} пуста`);
      return;
    }
    if (rooms.length > 0 && !confirm(`Заменить данные данными из №${copySourceNum}?`)) return;

    const copiedRooms = sourceRooms.map(r => ({
      id: crypto.randomUUID(),
      type: r.type,
      area: r.area,
      level: r.level || '1',
      height: r.height || '',
      isMezzanine: !!r.isMezzanine,
      unitId: unit.id,
    }));

    setRooms(copiedRooms);
    toast.success(`Скопировано из №${copySourceNum}`);
    setCopySourceNum('');
  };

  const handleSave = () => {
    if (isReadOnly) return;

    if (hasMezzanine && !mezzanineType) {
      toast.error('Выберите вид мезонина');
      return;
    }

    if (hasMezzanine && !rooms.some(r => r.isMezzanine)) {
      toast.error('Добавьте хотя бы одно помещение с признаком мезонина');
      return;
    }

    onSave({
      ...unit,
      hasMezzanine,
      mezzanineType: hasMezzanine ? mezzanineType : null,
      explication: rooms,
      area: stats.total,
      livingArea: stats.living,
      usefulArea: stats.useful,
      rooms: stats.living_rooms_count > 0 ? stats.living_rooms_count : unit.rooms,
    });
  };

  const statsContent = (
    <div className="grid grid-cols-4 gap-4">
      <StatBadge
        label="Жилая площадь"
        value={stats.living}
        subLabel={`${stats.living_rooms_count} жил. комн.`}
        color="bg-blue-50 text-blue-700 border-blue-100"
      />
      <StatBadge
        label="Полезная площадь"
        value={stats.useful}
        subLabel="Без балконов"
        color="bg-emerald-50 text-emerald-700 border-emerald-100"
      />
      <StatBadge
        label="Общая площадь"
        value={stats.total}
        subLabel="В кадастр (с коэфф.)"
        color="bg-slate-800 text-white border-slate-900 shadow-md"
      />

      <div
        className={`p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 justify-center ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <span className="text-[9px] uppercase font-bold text-slate-400 text-center">Копировать из №</span>
        <div className="flex gap-1">
          <input
            className="w-full text-center text-xs font-bold border border-slate-200 rounded-md outline-none focus:border-blue-500 py-1"
            value={copySourceNum}
            onChange={e => setCopySourceNum(e.target.value)}
            placeholder="..."
            onKeyDown={e => e.key === 'Enter' && handleCopy()}
            disabled={isReadOnly}
          />
          <button
            onClick={handleCopy}
            disabled={isReadOnly}
            aria-label="Скопировать экспликацию из другой квартиры"
            className="p-1 bg-white border border-slate-200 rounded-md hover:text-blue-600"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <RegistryModalLayout
      title={`${isReadOnly ? 'Просмотр' : 'Редактирование'} квартиры № ${unit.number}`}
      subTitle={`${buildingLabel} • ${isDuplex ? 'ДУПЛЕКС' : 'Типовая'}`}
      onClose={onClose}
      onSave={handleSave}
      isReadOnly={isReadOnly}
      statsContent={statsContent}
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={hasMezzanine}
              onChange={e => setHasMezzanine(e.target.checked)}
              disabled={isReadOnly}
            />
            В юните есть мезонин
          </label>
          {hasMezzanine && (
            <div className="mt-2">
              <Select
                value={mezzanineType}
                onChange={e => setMezzanineType(e.target.value)}
                disabled={isReadOnly}
                className="text-xs py-2"
              >
                {MEZZANINE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="grid gap-3 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider grid-cols-12">
          <div className="col-span-1 text-center">#</div>
          {isDuplex ? (
            <>
              <div className="col-span-2">Уровень</div>
              <div className="col-span-5">Тип</div>
            </>
          ) : (
            <div className="col-span-7">Тип помещения</div>
          )}
          <div className="col-span-2 text-right">Площадь</div>
          <div className="col-span-1 text-center">Выс.</div>
          <div className="col-span-1 text-center">Мез.</div>
        </div>

        {rooms.map((room, idx) => {
          const typeInfo = residentialRoomTypes.find(t => t.id === room.type);
          const k = typeInfo?.k || 1;

          return (
            <div
              key={room.id}
              className="grid grid-cols-12 gap-3 items-center p-2 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors"
            >
              <div className="col-span-1 flex justify-center">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center">
                  {idx + 1}
                </div>
              </div>

              {isDuplex && (
                <div className="col-span-2">
                  <Select
                    value={room.level || '1'}
                    onChange={e => updateRoom(room.id, 'level', e.target.value)}
                    className="text-xs py-2 bg-slate-50 border-slate-100"
                    disabled={isReadOnly}
                  >
                    <option value="1">1 ур.</option>
                    <option value="2">2 ур.</option>
                  </Select>
                </div>
              )}

              <div className={isDuplex ? 'col-span-5' : 'col-span-7'}>
                <Select
                  value={room.type}
                  onChange={e => updateRoom(room.id, 'type', e.target.value)}
                  className="text-xs py-2 bg-slate-50 border-slate-100 w-full"
                  disabled={isReadOnly}
                >
                  {residentialRoomTypes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label} {t.k < 1 ? `(k=${t.k})` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="col-span-2 relative">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={room.area}
                  onChange={e => updateRoom(room.id, 'area', e.target.value)}
                  placeholder="0.00"
                  className="text-xs py-2 font-bold text-right pr-6"
                  disabled={isReadOnly}
                />
                {k < 1 && <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono">x{k}</div>}
              </div>

              <div className="col-span-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={room.height || ''}
                  onChange={e => updateRoom(room.id, 'height', e.target.value)}
                  placeholder="2.70"
                  className="text-xs py-2 font-bold text-right"
                  disabled={isReadOnly}
                />
              </div>

              <div className="col-span-1 flex justify-center">
                <input
                  type="checkbox"
                  checked={!!room.isMezzanine}
                  onChange={e => updateRoom(room.id, 'isMezzanine', e.target.checked)}
                  disabled={isReadOnly || !hasMezzanine}
                />
              </div>

              <div className="col-span-12 flex justify-end -mt-1">
                {!isReadOnly && (
                  <button
                    onClick={() => removeRoom(room.id)}
                    aria-label="Удалить помещение"
                    className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!isReadOnly && (
          <button
            onClick={addRoom}
            disabled={!residentialRoomTypes.length}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-500 font-bold text-xs hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
          >
            <Plus size={16} /> Добавить комнату
          </button>
        )}
      </div>
    </RegistryModalLayout>
  );
}
