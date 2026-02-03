import React, { useState, useMemo } from 'react';
import { Briefcase, Warehouse, Utensils, Bath, Box, Layers, Sun, Trash2, Plus, Copy } from 'lucide-react';
import { Input, Select, useReadOnly } from '../../../ui/UIKit';
import { useToast } from '../../../../context/ToastContext';
import { useProject } from '../../../../context/ProjectContext';
import RegistryModalLayout, { StatBadge } from './RegistryModalLayout';

const COMMERCIAL_ROOMS = [
    { id: 'main_hall', label: 'Торговый зал / Опенспейс', icon: Briefcase, k: 1.0, category: 'main' },
    { id: 'cabinet', label: 'Кабинет', icon: Briefcase, k: 1.0, category: 'main' },
    { id: 'storage', label: 'Склад / Подсобное', icon: Warehouse, k: 1.0, category: 'aux' },
    { id: 'kitchen', label: 'Кухня (для персонала)', icon: Utensils, k: 1.0, category: 'aux' },
    { id: 'bathroom', label: 'Санузел', icon: Bath, k: 1.0, category: 'aux' },
    { id: 'corridor', label: 'Коридор', icon: Box, k: 1.0, category: 'aux' },
    { id: 'tambour', label: 'Тамбур / Входная группа', icon: Box, k: 1.0, category: 'aux' },
    { id: 'tech', label: 'Тех. помещение', icon: Layers, k: 1.0, category: 'aux' },
    { id: 'terrace', label: 'Терраса (k=0.3)', icon: Sun, k: 0.3, category: 'summer' },
];

export default function CommercialInventoryModal({ unit, buildingLabel, onClose, onSave }) {
    const { flatMatrix } = useProject();
    const isReadOnly = useReadOnly();
    const toast = useToast();
    
    const [rooms, setRooms] = useState(unit.explication || []); 
    const [copySourceNum, setCopySourceNum] = useState(''); 
    
    // Расчет ТЭП Коммерции
    const stats = useMemo(() => {
        let s_total = 0;
        let s_main = 0;
        let s_aux = 0;
        let count_main = 0;

        rooms.forEach(r => {
            const rawArea = parseFloat(r.area) || 0;
            const typeConfig = COMMERCIAL_ROOMS.find(t => t.id === r.type) || { k: 1.0, category: 'aux' };
            const effectiveArea = rawArea * typeConfig.k;

            s_total += effectiveArea;

            if (typeConfig.category === 'main') {
                s_main += rawArea;
                count_main++;
            } else if (typeConfig.category === 'aux') {
                s_aux += rawArea;
            }
        });

        return { 
            total: s_total.toFixed(2),
            main: s_main.toFixed(2),
            aux: s_aux.toFixed(2),
            main_rooms_count: count_main
        };
    }, [rooms]);

    const addRoom = () => {
        if (isReadOnly) return;
        setRooms([...rooms, { id: crypto.randomUUID(), type: 'main_hall', area: '', unitId: unit.id }]);
    };

    const removeRoom = (id) => {
        if (isReadOnly) return;
        setRooms(rooms.filter(r => r.id !== id));
    };

    const updateRoom = (id, field, value) => {
        if (isReadOnly) return;
        setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleCopy = () => {
        if (isReadOnly || !copySourceNum.trim()) return;
        const buildingPrefix = unit.buildingId;
        const sourceEntry = Object.entries(flatMatrix).find(([key, u]) => {
            return key.startsWith(buildingPrefix) && String(u.num) === String(copySourceNum) && key !== unit.id;
        });

        if (!sourceEntry) { toast.error(`Помещение №${copySourceNum} не найдено`); return; }
        const sourceUnit = sourceEntry[1];
        const sourceRooms = sourceUnit.explication || sourceUnit.roomsList; 

        if (!sourceRooms || sourceRooms.length === 0) { toast.error(`Помещение №${copySourceNum} пустое`); return; }
        if (rooms.length > 0 && !confirm(`Заменить данные данными из №${copySourceNum}?`)) return;

        const copiedRooms = sourceRooms.map(r => ({
            id: crypto.randomUUID(),
            type: r.type,
            area: r.area,
            unitId: unit.id
        }));

        setRooms(copiedRooms);
        toast.success(`Скопировано из №${copySourceNum}`);
        setCopySourceNum(''); 
    };

    const handleSave = () => {
        if (isReadOnly) return;
        onSave({
            ...unit,
            roomsList: rooms, 
            area: stats.total, 
            mainArea: stats.main,
            auxArea: stats.aux,
            rooms: stats.main_rooms_count > 0 ? stats.main_rooms_count : unit.rooms 
        });
    };

    const statsContent = (
        <div className="grid grid-cols-4 gap-4">
            <StatBadge label="Основная площадь" value={stats.main} subLabel="Торговая / Офисная" color="bg-emerald-50 text-emerald-700 border-emerald-100"/>
            <StatBadge label="Вспомогательная" value={stats.aux} subLabel="Склады, С/У, Коридоры" color="bg-slate-100 text-slate-700 border-slate-200"/>
            <StatBadge label="Общая площадь" value={stats.total} subLabel="В кадастр (с коэфф.)" color="bg-slate-800 text-white border-slate-900 shadow-md"/>
            
            <div className={`p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 justify-center ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                <span className="text-[9px] uppercase font-bold text-slate-400 text-center">Копировать из №</span>
                <div className="flex gap-1">
                    <input 
                        className="w-full text-center text-xs font-bold border border-slate-200 rounded-md outline-none focus:border-blue-500 py-1"
                        value={copySourceNum}
                        onChange={(e) => setCopySourceNum(e.target.value)}
                        placeholder="..."
                        onKeyDown={(e) => e.key === 'Enter' && handleCopy()}
                        disabled={isReadOnly}
                    />
                    <button onClick={handleCopy} disabled={isReadOnly} className="p-1 bg-white border border-slate-200 rounded-md hover:text-blue-600"><Copy size={14}/></button>
                </div>
            </div>
        </div>
    );

    return (
        <RegistryModalLayout
            title={`${isReadOnly ? 'Просмотр' : 'Редактирование'} помещения № ${unit.number}`}
            subTitle={`${buildingLabel} • ${unit.floorLabel}`}
            onClose={onClose}
            onSave={handleSave}
            isReadOnly={isReadOnly}
            statsContent={statsContent}
        >
            <div className="space-y-3">
                <div className={`grid gap-3 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider grid-cols-12`}>
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-8">Тип помещения</div>
                    <div className="col-span-2 text-right">Площадь</div>
                    <div className="col-span-1"></div>
                </div>

                {rooms.map((room, idx) => {
                    const typeInfo = COMMERCIAL_ROOMS.find(t => t.id === room.type);
                    const k = typeInfo?.k || 1;
                    
                    return (
                        <div key={room.id} className="grid grid-cols-12 gap-3 items-center p-2 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-colors">
                            <div className="col-span-1 flex justify-center">
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center">{idx + 1}</div>
                            </div>

                            <div className="col-span-8">
                                <Select value={room.type} onChange={(e) => updateRoom(room.id, 'type', e.target.value)} className="text-xs py-2 bg-slate-50 border-slate-100 w-full" disabled={isReadOnly}>
                                    {COMMERCIAL_ROOMS.map(t => <option key={t.id} value={t.id}>{t.label} {t.k < 1 ? `(k=${t.k})` : ''}</option>)}
                                </Select>
                            </div>

                            <div className="col-span-2 relative">
                                <Input type="number" min="0" step="0.01" value={room.area} onChange={(e) => updateRoom(room.id, 'area', e.target.value)} placeholder="0.00" className="text-xs py-2 font-bold text-right pr-6" disabled={isReadOnly} />
                                {k < 1 && <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono">x{k}</div>}
                            </div>
                            
                            <div className="col-span-1 flex justify-end">
                                {!isReadOnly && <button onClick={() => removeRoom(room.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>}
                            </div>
                        </div>
                    );
                })}

                {!isReadOnly && (
                    <button onClick={addRoom} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-500 font-bold text-xs hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                        <Plus size={16}/> Добавить помещение
                    </button>
                )}
            </div>
        </RegistryModalLayout>
    );
}