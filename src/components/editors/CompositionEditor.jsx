import React, { useState } from 'react';
import { 
  Home, Layout, Car, Box, Pencil, Trash2, X, Sparkles, Building2, 
  Calendar, Hash, Clock, ArrowRight, Plus, Layers
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Button, Input, Select, Label, SectionTitle } from '../ui/UIKit';

// --- Хелперы ---
const calculateProgress = (start, end) => {
    if (!start || !end) return 0;
    const total = new Date(end).getTime() - new Date(start).getTime();
    const current = new Date().getTime() - new Date(start).getTime();
    if (total <= 0) return 0;
    const percent = (current / total) * 100;
    return Math.min(100, Math.max(0, percent));
};

const getStageColor = (stage) => {
    switch(stage) {
        case 'Введенный': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'Строящийся': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Проектный': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'Архив': return 'bg-slate-100 text-slate-500 border-slate-200';
        default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
};

const TYPE_NAMES = {
    residential: "Отдельный жилой дом", 
    residential_multiblock: "Жилой дом из нескольких секций/блоков", 
    parking_separate: "Отдельный паркинг", 
    infrastructure: "Объект инфраструктуры" 
};

const PARKING_CONSTRUCTION_NAMES = {
    capital: "Капитальный",
    light: "Из легких конструкций",
    open: "Открытый"
};

export default function CompositionEditor() {
    const { composition, setComposition, buildingDetails, setBuildingDetails, saveData } = useProject();

    const [modal, setModal] = useState({ 
        isOpen: false, 
        category: null, 
        quantity: 1, 
        resBlocks: 1, 
        nonResBlocks: 0, 
        hasNonResPart: false, 
        baseName: "", 
        houseNumber: "",    
        dateStart: "",      
        dateEnd: "",        
        stage: "Проектный",
        editingId: null, 
        parkingType: 'underground', 
        parkingConstruction: 'capital', 
        infraType: 'Котельная' 
    });

    // --- ЛОГИКА ---
    const generateDemoComplex = () => {
        if (!window.confirm("Создать демо-данные? Текущий список будет дополнен.")) return;
        const timestamp = Date.now();
        const demoBuildings = [
            { 
                id: `b_${timestamp}_1`, label: 'Корпус "Доминанта"', houseNumber: "1", stage: "Строящийся", 
                dateStart: "2023-01-01", dateEnd: "2025-12-31", 
                type: TYPE_NAMES.residential,
                category: 'residential', resBlocks: 1, nonResBlocks: 0, hasNonResPart: true 
            },
            { 
                id: `b_${timestamp}_2`, label: 'Паркинг "Север"', houseNumber: "P-1", stage: "Введенный", 
                dateStart: "2022-06-01", dateEnd: "2023-06-01", 
                type: TYPE_NAMES.parking_separate,
                category: 'parking_separate', parkingType: 'ground', constructionType: 'capital'
            },
            { 
                id: `b_${timestamp}_3`, label: 'Детский сад', houseNumber: "12", stage: "Проектный", 
                dateStart: "2024-09-01", dateEnd: "2025-09-01", 
                type: TYPE_NAMES.infrastructure,
                category: 'infrastructure', infraType: 'Детский сад' 
            },
        ];
        
        const demoDetails = {};
        demoBuildings.forEach(b => {
             demoDetails[`${b.id}_main`] = { floorsFrom: 10, floorsTo: 10, entrances: 2, hasBasementFloor: true };
             demoDetails[`${b.id}_features`] = { basements: [] };
        });

        const newComposition = [...composition, ...demoBuildings];
        setComposition(newComposition);
        setBuildingDetails(prev => ({ ...prev, ...demoDetails }));
        saveData({ composition: newComposition }); 
    };

    const openPlanning = (category) => {
        const defaultName = TYPE_NAMES[category] || "Новый объект";

        setModal({ 
            isOpen: true, 
            category, 
            quantity: 1, 
            resBlocks: category.includes('multiblock') ? 2 : (category.includes('residential') ? 1 : 0), 
            nonResBlocks: 0, 
            hasNonResPart: false, 
            baseName: defaultName,
            houseNumber: "",
            dateStart: "",
            dateEnd: "",
            stage: "Проектный",
            parkingType: 'underground', 
            parkingConstruction: 'capital', 
            infraType: 'Котельная', 
            editingId: null 
        });
    };

    const openEditing = (item) => {
        setModal({ 
            isOpen: true, 
            ...item, 
            editingId: item.id, 
            baseName: item.label, 
            parkingConstruction: item.constructionType || 'capital'
        });
    };
    
    const commitPlanning = () => {
         let itemType = TYPE_NAMES[modal.category];
         
         const newItemData = {
             label: modal.baseName,
             houseNumber: modal.houseNumber,
             dateStart: modal.dateStart,
             dateEnd: modal.dateEnd,
             stage: modal.stage,
             type: itemType,
             
             category: modal.category,
             categoryType: modal.category === 'infrastructure' ? modal.infraType : itemType,
             constructionType: modal.parkingConstruction,
             resBlocks: modal.resBlocks, 
             nonResBlocks: modal.nonResBlocks, 
             hasNonResPart: modal.hasNonResPart, 
             parkingType: modal.parkingType, 
             infraType: modal.infraType 
         };

         if (modal.editingId) {
             const updated = composition.map(c => c.id === modal.editingId ? { ...c, ...newItemData } : c);
             setComposition(updated);
             saveData({ composition: updated });
         } else {
             const newItems = Array.from({length: modal.quantity}).map((_, i) => ({
                 id: `b_${Date.now()}_${i}`, 
                 ...newItemData,
                 label: modal.quantity > 1 ? `${modal.baseName} ${i+1}` : modal.baseName, 
             }));
             const newList = [...composition, ...newItems];
             setComposition(newList);
             saveData({ composition: newList });
         }
         setModal({...modal, isOpen: false});
    };
    
    const deleteItem = (id) => {
        if(confirm('Удалить этот объект?')) {
            const newList = composition.filter(c => c.id !== id);
            setComposition(newList);
            saveData({ composition: newList });
        }
    };

    return (
        // УБРАЛИ max-w-7xl, теперь тянется на всю ширину (w-full) с отступами px-6
        <div className="w-full px-6 pb-20 animate-in fade-in duration-500">
            
            {/* --- ШАПКА --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-2 gap-4">
                <div>
                    {/* Заголовок теперь более явный */}
                    <h1 className="text-2xl font-bold text-slate-800">Состав комплекса</h1>
                    <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                        Создание и управление перечнем строений
                    </p>
                </div>
                <div className="flex gap-3">
                     <Button onClick={generateDemoComplex} variant="secondary" className="bg-white border border-slate-200 hover:bg-purple-50 hover:text-purple-600 transition-all shadow-sm">
                        <Sparkles size={16} /> Демо-данные
                    </Button>
                     <div className="h-10 px-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center shadow-lg shadow-slate-900/20">
                        {composition.length} объектов
                    </div>
                </div>
            </div>

            {/* --- ТУЛБАР СОЗДАНИЯ --- */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
                <span className="text-xs font-bold text-slate-400 uppercase mr-2">Создать:</span>
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'residential', label: 'Жилой дом', icon: Home, color: 'text-slate-700 bg-white border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:shadow-md' },
                        { id: 'residential_multiblock', label: 'Многоблочный', icon: Layers, color: 'text-slate-700 bg-white border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md' },
                        { id: 'parking_separate', label: 'Паркинг', icon: Car, color: 'text-slate-700 bg-white border-slate-200 hover:border-slate-400 hover:text-slate-900 hover:shadow-md' },
                        { id: 'infrastructure', label: 'Инфраструктура', icon: Box, color: 'text-slate-700 bg-white border-slate-200 hover:border-amber-400 hover:text-amber-600 hover:shadow-md' }
                    ].map(btn => (
                        <button 
                            key={btn.id} 
                            onClick={() => openPlanning(btn.id)} 
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-sm ${btn.color}`}
                        >
                            <btn.icon size={14} />
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- ТАБЛИЦА ОБЪЕКТОВ --- */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                {/* Header Таблицы - Темный фон для контраста */}
                <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-200 py-4 px-6 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-1 text-center">Дом №</div>
                    <div className="col-span-3">Наименование</div>
                    <div className="col-span-3">Характеристики</div>
                    <div className="col-span-3">Статус / Сроки</div>
                    <div className="col-span-1 text-right"></div>
                </div>

                {composition.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                            <Building2 size={32} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700">Список объектов пуст</h3>
                        <p className="text-xs text-slate-400 mt-1">Используйте кнопки сверху для создания</p>
                    </div>
                )}

                <div className="divide-y divide-slate-100">
                    {composition.map((item, idx) => {
                        const progress = calculateProgress(item.dateStart, item.dateEnd);
                        const isRes = item.category.includes('residential');
                        
                        let detailsBadge = null;
                        if (item.category === 'parking_separate') {
                            const pType = item.parkingType === 'ground' ? 'Наземный' : 'Подземный';
                            const pConstName = PARKING_CONSTRUCTION_NAMES[item.constructionType] || item.constructionType;
                            detailsBadge = `${pType} • ${pConstName}`;
                        }

                        return (
                            <div key={item.id} className="grid grid-cols-12 items-center py-4 px-6 hover:bg-blue-50/50 transition-colors group even:bg-slate-50/50">
                                {/* # (Центрировано) */}
                                <div className="col-span-1 text-xs font-bold text-slate-400 text-center">{idx + 1}</div>
                                
                                {/* Номер дома (Центрировано) */}
                                <div className="col-span-1 flex justify-center">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shadow-sm border ${isRes ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-amber-700'}`}>
                                        {item.houseNumber || '?'}
                                    </div>
                                </div>

                                {/* Наименование */}
                                <div className="col-span-3 pr-4">
                                    <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{item.label}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{item.type}</div>
                                </div>

                                {/* Характеристики */}
                                <div className="col-span-3 pr-4 flex flex-col justify-center gap-1.5">
                                    <div className="flex flex-wrap gap-1">
                                        {(item.resBlocks > 0 || item.nonResBlocks > 0) && (
                                            <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px] font-bold text-slate-600">
                                                {item.resBlocks} жил. / {item.nonResBlocks} нежил.
                                            </span>
                                        )}
                                        {item.hasNonResPart && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-bold">Коммерция</span>}
                                        {item.category === 'infrastructure' && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold">{item.infraType}</span>}
                                        {detailsBadge && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">{detailsBadge}</span>}
                                    </div>
                                </div>

                                {/* Статус и Прогресс */}
                                <div className="col-span-3 pr-8">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${getStageColor(item.stage)}`}>
                                            {item.stage || 'Проект'}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">{Math.round(progress)}%</span>
                                    </div>
                                    
                                    {/* Тонкий прогресс бар */}
                                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                            style={{ width: `${progress}%` }} 
                                        />
                                    </div>
                                    
                                    {/* Даты */}
                                    <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                                        <span>{item.dateStart ? new Date(item.dateStart).toLocaleDateString('ru-RU') : '...'}</span>
                                        <span>{item.dateEnd ? new Date(item.dateEnd).toLocaleDateString('ru-RU') : '...'}</span>
                                    </div>
                                </div>

                                {/* Действия */}
                                <div className="col-span-1 flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditing(item)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                        <Pencil size={16}/>
                                    </button>
                                    <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- МОДАЛЬНОЕ ОКНО --- */}
            {modal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/20 animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{modal.editingId ? "Редактирование объекта" : "Создание объекта"}</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Заполните паспортные данные строения</p>
                            </div>
                            <button onClick={() => setModal({...modal, isOpen: false})} className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-200">
                                <X size={20} className="text-slate-400 hover:text-slate-700"/>
                            </button>
                        </div>
                        
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            
                            {/* ЛЕВАЯ КОЛОНКА */}
                            <div className="space-y-5">
                                <SectionTitle icon={Hash}>Идентификация</SectionTitle>
                                
                                <div className="space-y-1.5">
                                    <Label>Номер дома / Корпус <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                        <Input 
                                            value={modal.houseNumber} 
                                            onChange={(e) => setModal({...modal, houseNumber: e.target.value})} 
                                            placeholder="12А" 
                                            className="pl-9 font-bold text-lg uppercase"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Наименование</Label>
                                    <Input 
                                        value={modal.baseName} 
                                        onChange={(e) => setModal({...modal, baseName: e.target.value})} 
                                        placeholder="Например: Отдельный жилой дом" 
                                    />
                                </div>

                                {!modal.editingId && (
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex justify-between items-center">
                                            <Label className="mb-0">Количество копий</Label>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => setModal(m => ({...m, quantity: Math.max(1, m.quantity - 1)}))} className="w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center font-bold text-slate-500 hover:text-blue-600">-</button>
                                                <span className="font-bold text-lg w-4 text-center">{modal.quantity}</span>
                                                <button onClick={() => setModal(m => ({...m, quantity: m.quantity + 1}))} className="w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center font-bold text-slate-500 hover:text-blue-600">+</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ПРАВАЯ КОЛОНКА */}
                            <div className="space-y-5">
                                <SectionTitle icon={Clock}>Параметры и Сроки</SectionTitle>

                                {/* ДИНАМИЧЕСКИЕ ПОЛЯ */}
                                {modal.category === 'residential_multiblock' && (
                                    <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in">
                                        <div className="space-y-1">
                                            <Label>Жилых блоков</Label>
                                            <Input type="number" min="0" value={modal.resBlocks} onChange={(e) => setModal({...modal, resBlocks: Math.max(0, parseInt(e.target.value)||0)})} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Нежилых</Label>
                                            <Input type="number" min="0" value={modal.nonResBlocks} onChange={(e) => setModal({...modal, nonResBlocks: Math.max(0, parseInt(e.target.value)||0)})} />
                                        </div>
                                    </div>
                                )}

                                {modal.category === 'parking_separate' && (
                                    <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in">
                                        <div className="space-y-1.5">
                                            <Label>Тип паркинга</Label>
                                            <Select value={modal.parkingType} onChange={e => setModal({...modal, parkingType: e.target.value})}>
                                                <option value="underground">Подземный</option>
                                                <option value="ground">Наземный</option>
                                            </Select>
                                        </div>
                                        {modal.parkingType === 'ground' && (
                                            <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                                <Label>Конструктив</Label>
                                                <Select value={modal.parkingConstruction} onChange={e => setModal({...modal, parkingConstruction: e.target.value})}>
                                                    <option value="capital">Капитальный</option>
                                                    <option value="light">Из легких конструкций</option>
                                                    <option value="open">Открытый</option>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {modal.category === 'infrastructure' && (
                                    <div className="space-y-1.5 p-3 bg-amber-50 rounded-xl border border-amber-100 animate-in fade-in">
                                        <Label>Тип объекта</Label>
                                        <Select value={modal.infraType} onChange={(e) => setModal({...modal, infraType: e.target.value})}>
                                            <option value="Котельная">Котельная</option>
                                            <option value="ТП">ТП</option>
                                            <option value="Детский сад">Детский сад</option>
                                            <option value="Школа">Школа</option>
                                            <option value="КПП">КПП</option>
                                        </Select>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label>Текущая стадия</Label>
                                    <Select value={modal.stage} onChange={e => setModal({...modal, stage: e.target.value})}>
                                        <option value="Проектный">📁 Проектный</option>
                                        <option value="Строящийся">🏗️ Строящийся</option>
                                        <option value="Введенный">🔑 Введенный</option>
                                        <option value="Архив">📦 Архив</option>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label>Начало работ</Label>
                                        <Input type="date" value={modal.dateStart} onChange={(e) => setModal({...modal, dateStart: e.target.value})} className="text-xs font-bold"/>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Ввод в экспл.</Label>
                                        <Input type="date" value={modal.dateEnd} onChange={(e) => setModal({...modal, dateEnd: e.target.value})} className="text-xs font-bold"/>
                                    </div>
                                </div>

                                {modal.category?.includes('residential') && (
                                    <div className="pt-2 border-t border-slate-100 mt-2">
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <input type="checkbox" checked={modal.hasNonResPart} onChange={(e) => setModal({...modal, hasNonResPart: e.target.checked})} className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"/>
                                            <div>
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">Есть коммерция</span>
                                                <p className="text-[10px] text-slate-400">Встроенные магазины/офисы</p>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => setModal({...modal, isOpen: false})}>Отмена</Button>
                            <Button onClick={commitPlanning} className="shadow-xl shadow-blue-200/50 px-8">
                                <ArrowRight size={18} /> Сохранить объект
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}