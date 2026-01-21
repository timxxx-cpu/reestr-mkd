import React, { useState } from 'react';
import { 
  Wand2, Home, Layout, Car, Box, Plus, Pencil, Trash2, X, Sparkles, Building2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, Select, Button } from '../ui/UIKit';

// Вспомогательный компонент для бейджика
const Badge = ({ children, className = "" }) => (
  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border bg-purple-50 text-purple-600 border-purple-100 ${className}`}>
    {children}
  </span>
);

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
        editingId: null, 
        parkingType: 'underground', 
        parkingConstruction: 'multi', 
        infraType: 'Котельная' 
    });

    // --- АВТО-ГЕНЕРАЦИЯ СЛОЖНОГО КОМПЛЕКСА (Обновленная) ---
    const generateDemoComplex = () => {
        if (!window.confirm("Это добавит в проект тестовый набор зданий (Демо-ЖК). Существующие данные могут быть перезаписаны. Продолжить?")) return;

        const timestamp = Date.now();
        
        // 1. Создаем список зданий
        const demoBuildings = [
            { id: `b_${timestamp}_1`, label: 'Корпус 1 "Доминанта"', type: 'Жилой дом с нежилыми объектами', category: 'residential', resBlocks: 1, nonResBlocks: 0, hasNonResPart: true, parkingType: 'underground', infraType: 'Котельная' },
            { id: `b_${timestamp}_2`, label: 'Корпус 2 "Каскад"', type: 'Многоблочный дом', category: 'residential_multiblock', resBlocks: 4, nonResBlocks: 0, hasNonResPart: true, parkingType: 'none', infraType: 'Котельная' },
            { id: `b_${timestamp}_3`, label: 'Корпус 3 "Клубный"', type: 'Жилой дом', category: 'residential', resBlocks: 1, nonResBlocks: 0, hasNonResPart: false, parkingType: 'underground', infraType: 'Котельная' },
            { id: `b_${timestamp}_4`, label: 'Паркинг "Север"', type: 'Отдельный паркинг (Многоуровневый)', category: 'parking_separate', resBlocks: 0, nonResBlocks: 0, hasNonResPart: false, parkingType: 'ground', constructionType: 'multi', infraType: '' },
            { id: `b_${timestamp}_5`, label: 'Детский сад №12', type: 'Инфраструктура', category: 'infrastructure', resBlocks: 0, nonResBlocks: 0, hasNonResPart: false, parkingType: 'none', infraType: 'Детский сад' },
            // НОВЫЙ ОБЪЕКТ: СЛОЖНЫЙ МНОГОБЛОЧНИК
            { id: `b_${timestamp}_6`, label: 'Корпус 6 "Сити-Микс"', type: 'Многоблочный дом (Смешанный)', category: 'residential_multiblock', resBlocks: 2, nonResBlocks: 1, hasNonResPart: true, parkingType: 'underground', infraType: '' },
        ];

        // 2. Генерируем детальные настройки (этажность, подъезды)
        const demoDetails = {
            // Башня
            [`b_${timestamp}_1_main`]: { floorsFrom: 25, floorsTo: 25, entrances: 1, hasBasementFloor: true },
            [`b_${timestamp}_1_features`]: { material: 'monolith', parkingType: 'underground', basements: [{id: 1, depth: 2}] },

            // Каскад
            [`b_${timestamp}_2_main`]: { floorsFrom: 12, floorsTo: 16, entrances: 4, hasBasementFloor: true },
            [`b_${timestamp}_2_features`]: { material: 'panel', parkingType: 'none', basements: [{id: 1, depth: 1}] },

            // Клубный
            [`b_${timestamp}_3_main`]: { floorsFrom: 5, floorsTo: 5, entrances: 2, hasBasementFloor: false },
            [`b_${timestamp}_3_features`]: { material: 'brick', parkingType: 'attached', basements: [] },

            // Паркинг
            [`b_${timestamp}_4_main`]: { floorsFrom: 6, floorsTo: 6, entrances: 2, hasBasementFloor: false },
            [`b_${timestamp}_4_features`]: { material: 'monolith', parkingType: 'separate', basements: [] },

            // Садик
            [`b_${timestamp}_5_main`]: { floorsFrom: 2, floorsTo: 2, entrances: 1, hasBasementFloor: true },
            [`b_${timestamp}_5_features`]: { material: 'block', parkingType: 'none', basements: [{id: 1, depth: 1}] },

            // НОВЫЙ: Сити-Микс (2 жилых башни по 20 эт + 1 офисный блок 3 эт)
            [`b_${timestamp}_6_main`]: { floorsFrom: 3, floorsTo: 20, entrances: 3, hasBasementFloor: true },
            [`b_${timestamp}_6_features`]: { material: 'monolith', parkingType: 'underground', basements: [{id: 1, depth: 1}] },
        };

        const newComposition = composition.length === 0 ? demoBuildings : [...composition, ...demoBuildings];
        
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
            baseName: "Объект", 
            parkingType: 'underground', 
            parkingConstruction: 'multi', 
            infraType: 'Котельная', 
            editingId: null 
        });
    };

    const openEditing = (item) => {
        setModal({ 
            isOpen: true, 
            category: item.category, 
            quantity: 1, 
            resBlocks: item.resBlocks, 
            nonResBlocks: item.nonResBlocks, 
            hasNonResPart: item.hasNonResPart, 
            baseName: item.label, 
            editingId: item.id, 
            parkingType: item.parkingType, 
            infraType: item.infraType,
            parkingConstruction: item.constructionType || 'multi'
        });
    };
    
    const commitPlanning = () => {
         const types = { 
             residential: "Жилой дом", 
             residential_multiblock: "Многоблочный дом", 
             parking_separate: "Отдельный паркинг", 
             infrastructure: "Инфраструктура" 
         };
         
         let itemType = types[modal.category];
         let constructionLabel = '';

         if (modal.category === 'parking_separate') {
             const pType = modal.parkingType === 'ground' ? 'Наземный' : 'Подземный';
             const pConstMap = { 'capital': 'Капитальный', 'light': 'Из легких конструкций', 'open': 'Открытый', 'multi': 'Многоуровневый' };
             const pConst = modal.parkingType === 'ground' ? (pConstMap[modal.parkingConstruction] || '') : '';
             itemType = `${pType} паркинг`;
             constructionLabel = pConst ? ` (${pConst})` : '';
         } else if (modal.category === 'infrastructure') {
             itemType = modal.infraType;
         } else if (modal.category === 'residential' && modal.hasNonResPart) {
             itemType = "Жилой дом с нежилыми объектами";
         }

         const finalLabelSuffix = constructionLabel;

         if (modal.editingId) {
             const updated = composition.map(c => c.id === modal.editingId ? { 
                 ...c, 
                 label: modal.baseName, 
                 type: itemType + finalLabelSuffix, 
                 categoryType: itemType, 
                 constructionType: modal.parkingConstruction,
                 resBlocks: modal.resBlocks, 
                 nonResBlocks: modal.nonResBlocks, 
                 hasNonResPart: modal.hasNonResPart, 
                 parkingType: modal.parkingType, 
                 infraType: modal.infraType 
             } : c);
             setComposition(updated);
             saveData({ composition: updated });
         } else {
             const newItems = Array.from({length: modal.quantity}).map((_, i) => ({
                 id: `b_${Date.now()}_${i}`, 
                 label: modal.quantity > 1 ? `${modal.baseName} ${i+1}` : modal.baseName, 
                 type: itemType + finalLabelSuffix,
                 categoryType: itemType,
                 constructionType: modal.parkingConstruction,
                 category: modal.category, 
                 resBlocks: modal.resBlocks, 
                 nonResBlocks: modal.nonResBlocks, 
                 hasNonResPart: modal.hasNonResPart, 
                 parkingType: modal.parkingType, 
                 infraType: modal.infraType
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
        <div className="max-w-6xl mx-auto pb-20 relative animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Состав жилого комплекса</h1>
                    <p className="text-slate-500 text-sm mt-1">Формирование перечня строений</p>
                </div>
                <div className="flex gap-3 items-center">
                     <Button onClick={generateDemoComplex} variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 shadow-sm">
                        <Sparkles size={16} /> Демо-ЖК
                    </Button>
                     <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-lg min-w-[3rem] text-center shadow-sm border border-blue-100">
                        {composition.length}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                    <SectionTitle>Инструменты</SectionTitle>
                    {[
                        { id: 'residential', label: 'Жилой дом', icon: Home, color: 'bg-blue-600' },
                        { id: 'residential_multiblock', label: 'Многоблочный', icon: Layout, color: 'bg-indigo-600' },
                        { id: 'parking_separate', label: 'Отдельный паркинг', icon: Car, color: 'bg-slate-700' },
                        { id: 'infrastructure', label: 'Инфраструктура', icon: Box, color: 'bg-amber-600' }
                    ].map(btn => (
                        <button key={btn.id} onClick={() => openPlanning(btn.id)} className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all group active:scale-95">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl text-white shadow-md ${btn.color} group-hover:scale-110 transition-transform duration-200`}>
                                    <btn.icon size={20}/>
                                </div>
                                <span className="text-sm font-bold uppercase tracking-wide text-slate-700 group-hover:text-blue-600 transition-colors">{btn.label}</span>
                            </div>
                            <Plus size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </button>
                    ))}
                </div>

                <div className="md:col-span-2 space-y-4">
                    <Card className="border-t-4 border-t-blue-600 min-h-[500px] shadow-xl">
                        <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {composition.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <Building2 size={40} className="text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700">Список пуст</h3>
                                    <p className="text-slate-400 max-w-xs mt-2 text-sm">
                                        Добавьте строения вручную или сгенерируйте тестовый ЖК.
                                    </p>
                                    <Button onClick={generateDemoComplex} variant="outline" className="mt-6 border-dashed">
                                        Сгенерировать Демо-ЖК
                                    </Button>
                                </div>
                            )}
                            {composition.map((item, idx) => (
                                <div key={item.id} className="grid grid-cols-12 items-center p-5 hover:bg-blue-50/50 transition-all group cursor-default">
                                    <div className="col-span-1 text-center">
                                        <span className="text-xs font-bold text-slate-300 group-hover:text-blue-400 transition-colors">#{idx + 1}</span>
                                    </div>
                                    <div className="col-span-8 flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm transition-transform group-hover:scale-105 ${item.category.includes('residential') ? 'bg-gradient-to-br from-blue-500 to-blue-600' : item.category === 'parking_separate' ? 'bg-gradient-to-br from-slate-600 to-slate-700' : 'bg-gradient-to-br from-amber-500 to-amber-600'}`}>
                                            {item.category.includes('residential') ? 'Ж' : item.category === 'parking_separate' ? 'P' : 'И'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-base font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{item.label}</span>
                                                {item.hasNonResPart && <Badge>+ Нежилое</Badge>}
                                                {(item.nonResBlocks > 0) && <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100">Блоки: {item.resBlocks}Ж + {item.nonResBlocks}Н</Badge>}
                                                {item.category === 'parking_separate' && <Badge className="bg-slate-100 text-slate-600 border-slate-200">Паркинг</Badge>}
                                            </div>
                                            <div className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wide truncate max-w-[300px]">
                                                {item.type}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-span-3 flex justify-end gap-2 pr-2 items-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <button onClick={() => openEditing(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Редактировать">
                                            <Pencil size={16}/>
                                        </button>
                                        <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Удалить">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {modal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in duration-200 overflow-hidden ring-1 ring-slate-900/5">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">{modal.editingId ? "Редактирование объекта" : "Новый объект"}</h3>
                            <button onClick={() => setModal({...modal, isOpen: false})} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-400 hover:text-slate-600"/>
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-5">
                            {!modal.editingId && (
                                <div className="space-y-1.5">
                                    <Label>Количество (шт)</Label>
                                    <Input 
                                        type="number" 
                                        min="1" 
                                        value={modal.quantity} 
                                        onChange={(e) => setModal({...modal, quantity: Math.max(1, parseInt(e.target.value)||1)})} 
                                        className="font-bold text-lg"
                                    />
                                </div>
                            )}
                            
                            <div className="space-y-1.5">
                                <Label required>Наименование</Label>
                                <Input 
                                    type="text" 
                                    value={modal.baseName} 
                                    onChange={(e) => setModal({...modal, baseName: e.target.value})} 
                                    placeholder="Например: Литер 4" 
                                    autoFocus
                                />
                            </div>

                            {modal.category === 'residential_multiblock' && (
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="space-y-1">
                                        <Label>Жилых блоков</Label>
                                        <Input type="number" min="0" value={modal.resBlocks} onChange={(e) => setModal({...modal, resBlocks: Math.max(0, parseInt(e.target.value)||0)})} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Нежилых блоков</Label>
                                        <Input type="number" min="0" value={modal.nonResBlocks} onChange={(e) => setModal({...modal, nonResBlocks: Math.max(0, parseInt(e.target.value)||0)})} />
                                    </div>
                                </div>
                            )}

                            {modal.category?.includes('residential') && (
                                <label className="flex items-center gap-3 cursor-pointer p-4 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors">
                                    <input type="checkbox" checked={modal.hasNonResPart} onChange={(e) => setModal({...modal, hasNonResPart: e.target.checked})} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"/>
                                    <span className="text-sm font-bold text-blue-800">Есть встроенные нежилые помещения</span>
                                </label>
                            )}

                            {modal.category === 'parking_separate' && (
                                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="space-y-1">
                                        <Label>Тип паркинга</Label>
                                        <Select value={modal.parkingType} onChange={e => setModal({...modal, parkingType: e.target.value})}>
                                            <option value="underground">Подземный</option>
                                            <option value="ground">Наземный</option>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {modal.category === 'infrastructure' && (
                                <div className="space-y-1">
                                    <Label>Тип объекта</Label>
                                    <Select value={modal.infraType} onChange={(e) => setModal({...modal, infraType: e.target.value})}>
                                        <option value="Котельная">Котельная</option>
                                        <option value="ТП">ТП (Трансформаторная)</option>
                                        <option value="Градирня">Градирня</option>
                                        <option value="КПП">КПП</option>
                                        <option value="Детский сад">Детский сад</option>
                                        <option value="Школа">Школа</option>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t flex gap-3 justify-end">
                            <Button variant="secondary" onClick={() => setModal({...modal, isOpen: false})}>
                                Отмена
                            </Button>
                            <Button onClick={commitPlanning} className="shadow-lg shadow-blue-200">
                                Сохранить
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}