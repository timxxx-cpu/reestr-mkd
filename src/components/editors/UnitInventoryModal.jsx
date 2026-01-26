import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Save, Home, Utensils, Bath, BedDouble, Sofa, Box, Layers, Calculator, Sun, Copy, Briefcase, Warehouse } from 'lucide-react';
import { Button, Input, Select } from '../ui/UIKit';
import { useToast } from '../../context/ToastContext';
import { useProject } from '../../context/ProjectContext';

// --- ТИПЫ ПОМЕЩЕНИЙ ДЛЯ ЖИЛЬЯ ---
const RESIDENTIAL_ROOMS = [
    { id: 'living', label: 'Жилая комната', icon: BedDouble, k: 1.0, category: 'living' },
    { id: 'kitchen', label: 'Кухня', icon: Utensils, k: 1.0, category: 'useful' },
    { id: 'kitchen_living', label: 'Кухня-гостиная', icon: Sofa, k: 1.0, category: 'living' },
    { id: 'bathroom', label: 'Ванная / С/У', icon: Bath, k: 1.0, category: 'useful' },
    { id: 'corridor', label: 'Коридор / Холл', icon: Box, k: 1.0, category: 'useful' },
    { id: 'pantry', label: 'Кладовая / Гардероб', icon: Box, k: 1.0, category: 'useful' },
    { id: 'staircase', label: 'Внутрикв. лестница', icon: Layers, k: 1.0, category: 'useful' },
    { id: 'loggia', label: 'Лоджия (k=0.5)', icon: Sun, k: 0.5, category: 'summer' },
    { id: 'balcony', label: 'Балкон (k=0.3)', icon: Sun, k: 0.3, category: 'summer' },
    { id: 'other', label: 'Другое', icon: Box, k: 1.0, category: 'useful' },
];

// --- ТИПЫ ПОМЕЩЕНИЙ ДЛЯ КОММЕРЦИИ ---
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

// Мини-карточка для дашборда
const StatBadge = ({ label, value, subLabel, color }) => (
    <div className={`p-3 rounded-xl border ${color} flex flex-col items-center justify-center text-center w-full`}>
        <span className="text-[9px] uppercase font-bold tracking-wider opacity-70 mb-1">{label}</span>
        <span className="text-xl font-black leading-none">{value}</span>
        {subLabel && <span className="text-[9px] opacity-60 mt-1">{subLabel}</span>}
    </div>
);

export default function UnitInventoryModal({ unit, buildingLabel, onClose, onSave }) {
    const { flatMatrix } = useProject();
    const toast = useToast();
    
    // Определяем режим: Жилье или Коммерция
    const isCommercial = !['flat', 'duplex_up', 'duplex_down'].includes(unit.type);
    const isDuplex = ['duplex_up', 'duplex_down'].includes(unit.type);

    const ROOM_TYPES = isCommercial ? COMMERCIAL_ROOMS : RESIDENTIAL_ROOMS;

    const [rooms, setRooms] = useState(unit.roomsList || []);
    const [copySourceNum, setCopySourceNum] = useState(''); 
    
    // --- АВТОМАТИЧЕСКИЙ РАСЧЕТ ПЛОЩАДЕЙ ---
    const stats = useMemo(() => {
        let s_total = 0; // Общая (кадастровая)
        
        // Для жилья
        let s_living = 0;
        let s_useful = 0;
        
        // Для коммерции
        let s_main = 0;
        let s_aux = 0;

        let count_main = 0;

        rooms.forEach(r => {
            const rawArea = parseFloat(r.area) || 0;
            const typeConfig = ROOM_TYPES.find(t => t.id === r.type) || { k: 1.0, category: 'useful' };
            const effectiveArea = rawArea * typeConfig.k;

            s_total += effectiveArea;

            if (isCommercial) {
                if (typeConfig.category === 'main') {
                    s_main += rawArea;
                    count_main++;
                } else if (typeConfig.category === 'aux') {
                    s_aux += rawArea;
                }
                // Летние в коммерции обычно тоже идут в общую с коэфф, но не в основную
            } else {
                if (typeConfig.category === 'living') {
                    s_living += rawArea;
                    count_main++;
                } else if (typeConfig.category === 'useful') {
                    s_useful += rawArea;
                }
            }
        });

        return { 
            total: s_total.toFixed(2),
            // Жилые показатели
            living: s_living.toFixed(2), 
            useful: s_useful.toFixed(2),
            // Коммерческие показатели
            main: s_main.toFixed(2),
            aux: s_aux.toFixed(2),
            
            main_rooms_count: count_main
        };
    }, [rooms, isCommercial, ROOM_TYPES]);

    const addRoom = () => {
        setRooms([...rooms, { 
            id: crypto.randomUUID(), 
            type: isCommercial ? 'main_hall' : 'living', 
            area: '',
            level: '1'
        }]);
    };

    const removeRoom = (id) => {
        setRooms(rooms.filter(r => r.id !== id));
    };

    const updateRoom = (id, field, value) => {
        setRooms(rooms.map(r => {
            if (r.id !== id) return r;
            return { ...r, [field]: value };
        }));
    };

    const handleCopy = () => {
        if (!copySourceNum.trim()) return;

        const buildingPrefix = unit.buildingId;
        const sourceEntry = Object.entries(flatMatrix).find(([key, u]) => {
            return key.startsWith(buildingPrefix) && 
                   String(u.num) === String(copySourceNum) && 
                   key !== unit.id;
        });

        if (!sourceEntry) {
            toast.error(`Объект №${copySourceNum} не найден`);
            return;
        }

        const sourceUnit = sourceEntry[1];
        if (!sourceUnit.roomsList || sourceUnit.roomsList.length === 0) {
            toast.error(`Объект №${copySourceNum} пуст`);
            return;
        }

        if (rooms.length > 0) {
            if (!confirm(`Заменить данные данными из №${copySourceNum}?`)) return;
        }

        const copiedRooms = sourceUnit.roomsList.map(r => ({
            id: crypto.randomUUID(),
            type: r.type,
            area: r.area,
            level: r.level || '1'
        }));

        setRooms(copiedRooms);
        toast.success(`Скопировано из №${copySourceNum}`);
        setCopySourceNum(''); 
    };

    const handleSave = () => {
        const payload = {
            ...unit,
            roomsList: rooms,
            area: stats.total, // Общая всегда идет в area
            rooms: stats.main_rooms_count > 0 ? stats.main_rooms_count : unit.rooms 
        };

        // Дописываем специфичные поля
        if (isCommercial) {
            payload.mainArea = stats.main;
            payload.auxArea = stats.aux;
        } else {
            payload.livingArea = stats.living;
            payload.usefulArea = stats.useful;
        }

        onSave(payload);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                            <span className="font-bold uppercase">{buildingLabel}</span>
                            <span>•</span>
                            <span>{unit.floorLabel}</span>
                            {isDuplex && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">ДУПЛЕКС</span>}
                            {isCommercial && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">НЕЖИЛОЕ</span>}
                        </div>
                        <h3 className="text-2xl font-black text-slate-800">
                            {isCommercial ? 'Помещение' : 'Квартира'} № {unit.number}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-200">
                        <X size={20} className="text-slate-400 hover:text-slate-700"/>
                    </button>
                </div>

                {/* Dashboard (Сводные данные) */}
                <div className="p-6 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-2 mb-3 text-slate-400">
                        <Calculator size={16}/>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Показатели (ТЭП)</span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                        {isCommercial ? (
                            <>
                                <StatBadge label="Основная площадь" value={stats.main} subLabel="Торговая / Офисная" color="bg-emerald-50 text-emerald-700 border-emerald-100"/>
                                <StatBadge label="Вспомогательная" value={stats.aux} subLabel="Склады, С/У, Коридоры" color="bg-slate-100 text-slate-700 border-slate-200"/>
                            </>
                        ) : (
                            <>
                                <StatBadge label="Жилая площадь" value={stats.living} subLabel={`${stats.main_rooms_count} жил. комн.`} color="bg-blue-50 text-blue-700 border-blue-100"/>
                                <StatBadge label="Полезная площадь" value={stats.useful} subLabel="Без летних" color="bg-emerald-50 text-emerald-700 border-emerald-100"/>
                            </>
                        )}
                        
                        <StatBadge label="Общая площадь" value={stats.total} subLabel="В кадастр (с коэфф.)" color="bg-slate-800 text-white border-slate-900 shadow-md"/>
                        
                        {/* Кнопка копирования */}
                        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-2 justify-center">
                            <span className="text-[9px] uppercase font-bold text-slate-400 text-center">Копировать из №</span>
                            <div className="flex gap-1">
                                <input 
                                    className="w-full text-center text-xs font-bold border border-slate-200 rounded-md outline-none focus:border-blue-500 py-1"
                                    value={copySourceNum}
                                    onChange={(e) => setCopySourceNum(e.target.value)}
                                    placeholder="..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleCopy()}
                                />
                                <button onClick={handleCopy} className="p-1 bg-white border border-slate-200 rounded-md hover:text-blue-600"><Copy size={14}/></button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Room List */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="space-y-3">
                        {rooms.length > 0 && (
                            <div className={`grid gap-3 px-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider grid-cols-12`}>
                                <div className="col-span-1 text-center">#</div>
                                {isDuplex ? (
                                    <>
                                        <div className="col-span-2">Уровень</div>
                                        <div className="col-span-6">Тип помещения</div>
                                    </>
                                ) : (
                                    <div className="col-span-8">Тип помещения</div>
                                )}
                                <div className="col-span-2 text-right">Площадь</div>
                                <div className="col-span-1"></div>
                            </div>
                        )}

                        {rooms.map((room, idx) => {
                            const typeInfo = ROOM_TYPES.find(t => t.id === room.type);
                            const k = typeInfo?.k || 1;
                            
                            return (
                                <div key={room.id} className="grid grid-cols-12 gap-3 items-center p-2 bg-white rounded-xl border border-slate-200 shadow-sm group hover:border-blue-300 transition-colors">
                                    <div className="col-span-1 flex justify-center">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center">
                                            {idx + 1}
                                        </div>
                                    </div>

                                    {isDuplex && (
                                        <div className="col-span-2">
                                            <Select
                                                value={room.level || '1'}
                                                onChange={(e) => updateRoom(room.id, 'level', e.target.value)}
                                                className="text-xs py-2 bg-slate-50 border-slate-100 focus:bg-white text-purple-700 font-bold"
                                            >
                                                <option value="1">1 ур.</option>
                                                <option value="2">2 ур.</option>
                                            </Select>
                                        </div>
                                    )}

                                    <div className={isDuplex ? "col-span-6" : "col-span-8"}>
                                        <Select 
                                            value={room.type} 
                                            onChange={(e) => updateRoom(room.id, 'type', e.target.value)}
                                            className="text-xs py-2 bg-slate-50 border-slate-100 focus:bg-white w-full font-medium"
                                        >
                                            {ROOM_TYPES.map(t => (
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
                                            onChange={(e) => updateRoom(room.id, 'area', e.target.value)}
                                            placeholder="0.00"
                                            className="text-xs py-2 font-bold text-right bg-slate-50 border-slate-100 focus:bg-white pr-6"
                                        />
                                        {k < 1 && (
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-mono">
                                                x{k}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <button onClick={() => removeRoom(room.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        <button 
                            onClick={addRoom}
                            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-500 font-bold text-xs hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        >
                            <Plus size={16}/> Добавить {isCommercial ? 'помещение' : 'комнату'}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white border-t border-slate-200 flex justify-between items-center">
                    <div className="text-xs text-slate-400 max-w-md italic">
                        * Данные автоматически обновятся в общем реестре.
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose}>Отмена</Button>
                        <Button onClick={handleSave} className="px-8 shadow-lg shadow-blue-200">
                            <Save size={16} /> Сохранить
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}