import React, { useState, useMemo } from 'react';
import { 
  Wand2, Home, Layout, Car, Box, Plus, Pencil, Trash2, X, Sparkles, Building2, 
  Calendar, Hash, Clock, MoreVertical, ArrowRight
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Button, Input, Select, Label, SectionTitle } from '../ui/UIKit';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

// Функция для расчета прогресса по датам
const calculateProgress = (start, end) => {
    if (!start || !end) return 0;
    const total = new Date(end).getTime() - new Date(start).getTime();
    const current = new Date().getTime() - new Date(start).getTime();
    if (total <= 0) return 0;
    const percent = (current / total) * 100;
    return Math.min(100, Math.max(0, percent));
};

// Функция для цветов стадии
const getStageColor = (stage) => {
    switch(stage) {
        case 'Введенный': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'Строящийся': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Проектный': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'Архив': return 'bg-slate-100 text-slate-500 border-slate-200';
        default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
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
        parkingConstruction: 'multi', 
        infraType: 'Котельная' 
    });

    // --- ЛОГИКА (Оставили прежней, с небольшими улучшениями) ---

    const generateDemoComplex = () => {
        if (!window.confirm("Создать демо-данные? Текущий список будет дополнен.")) return;
        const timestamp = Date.now();
        const demoBuildings = [
            { id: `b_${timestamp}_1`, label: 'Корпус "Доминанта"', houseNumber: "1", stage: "Строящийся", dateStart: "2023-01-01", dateEnd: "2025-12-31", type: 'Жилой дом', category: 'residential', resBlocks: 1, nonResBlocks: 0, hasNonResPart: true },
            { id: `b_${timestamp}_2`, label: 'Паркинг "Север"', houseNumber: "P-1", stage: "Введенный", dateStart: "2022-06-01", dateEnd: "2023-06-01", type: 'Паркинг', category: 'parking_separate', parkingType: 'ground' },
            { id: `b_${timestamp}_3`, label: 'Детский сад', houseNumber: "12", stage: "Проектный", dateStart: "2024-09-01", dateEnd: "2025-09-01", type: 'Инфраструктура', category: 'infrastructure', infraType: 'Детский сад' },
        ];
        
        // Минимальные детали для демо
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
        setModal({ 
            isOpen: true, 
            category, 
            quantity: 1, 
            resBlocks: category.includes('multiblock') ? 2 : (category.includes('residential') ? 1 : 0), 
            nonResBlocks: 0, 
            hasNonResPart: false, 
            baseName: "", 
            houseNumber: "",
            dateStart: "",
            dateEnd: "",
            stage: "Проектный",
            parkingType: 'underground', 
            parkingConstruction: 'multi', 
            infraType: 'Котельная', 
            editingId: null 
        });
    };

    const openEditing = (item) => {
        setModal({ 
            isOpen: true, 
            ...item, // Копируем все поля из item
            editingId: item.id, 
            baseName: item.label, // Маппинг label -> baseName для формы
            parkingConstruction: item.constructionType || 'multi'
        });
    };
    
    const commitPlanning = () => {
         const types = { residential: "Жилой дом", residential_multiblock: "Многоблочный дом", parking_separate: "Отдельный паркинг", infrastructure: "Инфраструктура" };
         let itemType = types[modal.category];
         if (modal.category === 'infrastructure') itemType = modal.infraType;
         if (modal.category === 'parking_separate') itemType = modal.parkingType === 'ground' ? 'Наземный паркинг' : 'Подземный паркинг';

         const newItemData = {
             label: modal.baseName,
             houseNumber: modal.houseNumber,
             dateStart: modal.dateStart,
             dateEnd: modal.dateEnd,
             stage: modal.stage,
             type: itemType,
             category: modal.category,
             categoryType: itemType,
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
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
            {/* --- ШАПКА --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Состав комплекса</h1>
                    <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                        <Building2 size={14}/> 
                        Управление объектами строительства и инфраструктуры
                    </p>
                </div>
                <div className="flex gap-3">
                     <Button onClick={generateDemoComplex} variant="secondary" className="bg-white border border-slate-200 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-all shadow-sm">
                        <Sparkles size={16} /> Тест-драйв
                    </Button>
                     <div className="h-10 px-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center shadow-lg shadow-slate-900/20">
                        {composition.length} объектов
                    </div>
                </div>
            </div>

            {/* --- СЕТКА КАРТОЧЕК --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* 1. КАРТОЧКА "ДОБАВИТЬ" */}
                <div className="group border-2 border-dashed border-slate-300 rounded-3xl p-6 flex flex-col justify-center items-center gap-4 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-default min-h-[280px]">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-300 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                        <Plus size={32} />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-700 mb-2">Новый объект</h3>
                        <p className="text-xs text-slate-400 max-w-[200px] mx-auto mb-4">Выберите тип объекта для добавления в структуру ЖК</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {[
                                { id: 'residential', label: 'Дом', icon: Home },
                                { id: 'parking_separate', label: 'Паркинг', icon: Car },
                                { id: 'infrastructure', label: 'Инфра', icon: Box }
                            ].map(t => (
                                <button key={t.id} onClick={() => openPlanning(t.id)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 shadow-sm transition-all active:scale-95">
                                    <t.icon size={14}/> {t.label}
                                </button>
                            ))}
                        </div>
                        {/* Кнопка многоблочного скрыта в "еще", для чистоты UI можно добавить по желанию */}
                        <button onClick={() => openPlanning('residential_multiblock')} className="mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 underline decoration-dashed">
                            + Многоблочный дом
                        </button>
                    </div>
                </div>

                {/* 2. КАРТОЧКИ ОБЪЕКТОВ */}
                {composition.map((item) => {
                    const progress = calculateProgress(item.dateStart, item.dateEnd);
                    const isRes = item.category.includes('residential');
                    
                    return (
                        <div key={item.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[280px]">
                            {/* Градиентная полоска сверху */}
                            <div className={`absolute top-0 left-0 right-0 h-1.5 ${isRes ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-slate-400 to-slate-600'}`} />

                            {/* Верхняя часть */}
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-inner ${isRes ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {item.houseNumber || '?'}
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Номер дома</div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${getStageColor(item.stage)}`}>
                                                {item.stage || 'Проект'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditing(item)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={16}/></button>
                                        <button onClick={() => deleteItem(item.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-slate-800 mb-1 leading-tight">{item.label}</h3>
                                <p className="text-xs font-medium text-slate-400 mb-4">{item.type}</p>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {(item.resBlocks > 0 || item.nonResBlocks > 0) && (
                                        <div className="px-2 py-1 bg-slate-50 rounded border border-slate-100 text-[10px] font-bold text-slate-600">
                                            {item.resBlocks} жил. / {item.nonResBlocks} нежил.
                                        </div>
                                    )}
                                    {item.hasNonResPart && <div className="px-2 py-1 bg-indigo-50 rounded border border-indigo-100 text-[10px] font-bold text-indigo-600">Коммерция</div>}
                                </div>
                            </div>

                            {/* Нижняя часть: Даты и Прогресс */}
                            <div className="mt-auto pt-4 border-t border-slate-100">
                                <div className="flex justify-between items-end mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Calendar size={10}/> Срок реализации</span>
                                        <span className="text-xs font-bold text-slate-700">
                                            {item.dateStart ? new Date(item.dateStart).getFullYear() : '...'} — {item.dateEnd ? new Date(item.dateEnd).getFullYear() : '...'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-black text-blue-600">{Math.round(progress)}%</span>
                                    </div>
                                </div>
                                {/* Progress Bar */}
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${progress}%` }} 
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- МОДАЛЬНОЕ ОКНО (Новый дизайн) --- */}
            {modal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/20 animate-in zoom-in-95 duration-200">
                        {/* Header */}
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
                            
                            {/* ЛЕВАЯ КОЛОНКА: Идентификация */}
                            <div className="space-y-5">
                                <SectionTitle icon={Hash}>Идентификация</SectionTitle>
                                
                                <div className="space-y-1.5">
                                    <Label>Номер дома / Корпус <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                        <Input 
                                            value={modal.houseNumber} 
                                            onChange={(e) => setModal({...modal, houseNumber: e.target.value})} 
                                            placeholder="Например: 12А" 
                                            className="pl-9 font-bold text-lg uppercase"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Маркетинговое название</Label>
                                    <Input 
                                        value={modal.baseName} 
                                        onChange={(e) => setModal({...modal, baseName: e.target.value})} 
                                        placeholder="Например: Башня Свобода" 
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

                            {/* ПРАВАЯ КОЛОНКА: Параметры и Сроки */}
                            <div className="space-y-5">
                                <SectionTitle icon={Clock}>Параметры и Сроки</SectionTitle>

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

                                {/* Динамические поля в зависимости от типа */}
                                {modal.category?.includes('residential') && (
                                    <div className="pt-4 border-t border-slate-100">
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

                        {/* Footer */}
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