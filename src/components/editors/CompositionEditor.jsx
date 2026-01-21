import React, { useState } from 'react';
import { 
  Wand2, Home, Layout, Car, Box, Plus, Pencil, Copy, Trash2, X 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, Select, Button } from '../ui/UIKit';

// Вспомогательный компонент для бейджика (в UI Kit его не было, добавим локально или в Kit)
const Badge = ({ children, className = "" }) => (
  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border bg-purple-50 text-purple-600 border-purple-100 ${className}`}>
    {children}
  </span>
);

export default function CompositionEditor() {
    const { composition, setComposition, saveData } = useProject();

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
    
    const autoFillComposition = () => {
        const newComposition = [
            { id: `b_${Date.now()}_1`, label: "Башня А (Доминанта)", type: "Жилой дом с нежилыми объектами", categoryType: "Жилой дом", constructionType: 'multi', category: "residential", resBlocks: 1, nonResBlocks: 0, hasNonResPart: true, parkingType: 'underground', infraType: 'Котельная' },
            { id: `b_${Date.now()}_3`, label: "Многосекционный Дом 3", type: "Многоблочный дом", categoryType: "Многоблочный дом", constructionType: 'multi', category: "residential_multiblock", resBlocks: 3, nonResBlocks: 0, hasNonResPart: true, parkingType: 'underground', infraType: 'Котельная' },
        ];
        setComposition(newComposition);
        saveData({ composition: newComposition });
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 relative animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-8">
                <div><h1 className="text-2xl font-bold text-slate-800">Состав жилого комплекса</h1><p className="text-slate-500 text-sm mt-1">Формирование перечня строений</p></div>
                <div className="flex gap-2 items-center">
                     <button onClick={autoFillComposition} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors"><Wand2 size={14}/> Авто-генерация</button>
                     <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-lg min-w-[3rem] text-center">{composition.length}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                    <SectionTitle>Инструменты</SectionTitle>
                    {[
                        { id: 'residential', label: 'Жилой дом', icon: Home, color: 'bg-blue-600' },
                        { id: 'residential_multiblock', label: 'Многоблочный', icon: Layout, color: 'bg-indigo-600' },
                        { id: 'parking_separate', label: 'Отдельный паркинг', icon: Car, color: 'bg-slate-700' },
                        { id: 'infrastructure', label: 'Инфраструктура', icon: Box, color: 'bg-amber-600' }
                    ].map(btn => (
                        <button key={btn.id} onClick={() => openPlanning(btn.id)} className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group">
                            <div className="flex items-center gap-3"><div className={`p-2 rounded-xl text-white shadow-md ${btn.color} group-hover:scale-110 transition-transform`}><btn.icon size={18}/></div><span className="text-xs font-bold uppercase tracking-wide text-slate-700">{btn.label}</span></div>
                            <Plus size={16} className="text-slate-300 group-hover:text-blue-500" />
                        </button>
                    ))}
                </div>

                <div className="md:col-span-2 space-y-4">
                    <Card className="border-t-4 border-t-blue-600 min-h-[400px]">
                        <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                            {composition.length === 0 && <div className="p-12 text-center text-slate-400 font-medium flex flex-col items-center"><Box size={48} className="text-slate-200 mb-4"/>Список объектов пуст. Добавьте первый объект.</div>}
                            {composition.map((item, idx) => (
                                <div key={item.id} className="grid grid-cols-12 items-center p-5 hover:bg-slate-50 transition-all group">
                                    <div className="col-span-1 text-center text-xs text-slate-300 font-bold">{idx + 1}</div>
                                    <div className="col-span-7 flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm ${item.category.includes('residential') ? 'bg-blue-500' : 'bg-slate-700'}`}>{item.category.includes('residential') ? 'Ж' : item.category === 'parking_separate' ? 'P' : 'И'}</div>
                                        <div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-800">{item.label}</span>{item.hasNonResPart && <Badge>+ Нежилое</Badge>}</div><div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-wide truncate max-w-[250px]">{item.type}</div></div>
                                    </div>
                                    <div className="col-span-4 flex justify-end gap-2 pr-4 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="secondary" className="px-3" onClick={() => openEditing(item)}><Pencil size={14}/></Button>
                                        <Button variant="destructive" className="px-3" onClick={() => deleteItem(item.id)}><Trash2 size={14}/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {modal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="text-lg font-bold text-slate-800">{modal.editingId ? "Редактирование" : "Добавление"}</h3><button onClick={() => setModal({...modal, isOpen: false})}><X size={20} className="text-slate-400 hover:text-slate-600"/></button></div>
                        <div className="p-6 space-y-4">
                            {!modal.editingId && <div className="space-y-1"><Label>Количество</Label><Input type="number" min="1" value={modal.quantity} onChange={(e) => setModal({...modal, quantity: Math.max(1, parseInt(e.target.value)||1)})} /></div>}
                            <div className="space-y-1"><Label required>Наименование</Label><Input type="text" value={modal.baseName} onChange={(e) => setModal({...modal, baseName: e.target.value})} placeholder="Например: Корпус 1" /></div>
                            {modal.category === 'residential_multiblock' && (<div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label>Жилых блоков</Label><Input type="number" min="0" value={modal.resBlocks} onChange={(e) => setModal({...modal, resBlocks: Math.max(0, parseInt(e.target.value)||0)})} /></div><div className="space-y-1"><Label>Нежилых блоков</Label><Input type="number" min="0" value={modal.nonResBlocks} onChange={(e) => setModal({...modal, nonResBlocks: Math.max(0, parseInt(e.target.value)||0)})} /></div></div>)}
                            {modal.category?.includes('residential') && (<label className="flex items-center gap-3 cursor-pointer p-4 bg-blue-50 rounded-xl border border-blue-100"><input type="checkbox" checked={modal.hasNonResPart} onChange={(e) => setModal({...modal, hasNonResPart: e.target.checked})} className="w-5 h-5 rounded text-blue-600"/><span className="text-xs font-bold text-blue-800">Есть встроенные нежилые помещения</span></label>)}
                            {modal.category === 'parking_separate' && (<><div className="space-y-1"><Label>Тип паркинга</Label><Select value={modal.parkingType} onChange={e => setModal({...modal, parkingType: e.target.value})}><option value="underground">Подземный</option><option value="ground">Наземный</option></Select></div></>)}
                            {modal.category === 'infrastructure' && (<div className="space-y-1"><Label>Тип объекта</Label><Select value={modal.infraType} onChange={(e) => setModal({...modal, infraType: e.target.value})}><option value="Котельная">Котельная</option><option value="ТП">ТП</option><option value="Градирня">Градирня</option><option value="КПП">КПП</option><option value="Детский сад">Детский сад</option><option value="Школа">Школа</option></Select></div>)}
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex gap-3 justify-end"><Button variant="secondary" onClick={() => setModal({...modal, isOpen: false})}>Отмена</Button><Button onClick={commitPlanning}>Сохранить</Button></div>
                    </div>
                </div>
            )}
        </div>
    );
}