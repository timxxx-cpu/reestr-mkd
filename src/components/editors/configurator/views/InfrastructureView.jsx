import React from 'react';
import { Box, ArrowUp, ArrowDownToLine, Footprints, X } from 'lucide-react';

// Импорты
import { useProject } from '../../../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, useReadOnly } from '../../../ui/UIKit';
import { BuildingConfigSchema } from '../../../../lib/schemas';
import { useValidation } from '../../../../hooks/useValidation';

// Наши красивые карточки
import ConstructiveCard from '../cards/ConstructiveCard';
import EngineeringCard from '../cards/EngineeringCard';

export default function InfrastructureView({ building }) {
    const { buildingDetails, setBuildingDetails } = useProject();
    const isReadOnly = useReadOnly();

    const detailsKey = `${building.id}_main`;
    const featuresKey = `${building.id}_features`;
    const features = buildingDetails[featuresKey] || { basements: [] };

    // Дефолтные значения (Пустые для валидации)
    const defaultDetails = { 
        foundation: '', walls: '', slabs: '', roof: '', seismicity: '', 
        floorsCount: '', floorsFrom: 1, // Всегда 1
        inputs: '', // Кол-во входов
        engineering: { hvs: false, gvs: false, heating: false, electricity: false, sewerage: false, ventilation: false, firefighting: false } 
    };

    const details = { ...defaultDetails, ...(buildingDetails[detailsKey] || {}) };
    const { errors } = useValidation(BuildingConfigSchema, details);

    // --- Логика ---
    const updateDetail = (key, val) => {
        if (isReadOnly) return;
        setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
    };

    const updateFloorsCount = (e) => {
        if (isReadOnly) return;
        const val = e.target.value;
        if (val === '') {
            updateDetail('floorsCount', '');
            return;
        }
        let num = parseInt(val);
        if (num > 3) num = 3; // Ограничение
        setBuildingDetails(prev => ({
            ...prev,
            [detailsKey]: { ...details, floorsCount: num, floorsFrom: 1 }
        }));
    };

    const updateFeatures = (updates) => {
        if (isReadOnly) return;
        setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, ...updates } }));
    };

    // --- Логика Подвала ---
    const blockBasements = (features.basements || []).filter(b => b.blockId === 'main');
    const canAddBasement = blockBasements.length < 3;

    const createBasement = () => {
        if (isReadOnly || !canAddBasement) return;
        const newB = { id: crypto.randomUUID(), depth: 1, blocks: ['main'], buildingId: building.id, blockId: 'main' };
        updateFeatures({ basements: [...(features.basements || []), newB] });
    };

    const removeBasement = (id) => {
        if (isReadOnly) return;
        updateFeatures({ basements: (features.basements || []).filter(b => b.id !== id) });
    };

    const updateBasement = (id, field, val) => {
        if (isReadOnly) return;
        const updated = (features.basements || []).map(b => b.id === id ? { ...b, [field]: val } : b);
        updateFeatures({ basements: updated });
    };

    // --- Хелперы UI ---
    const errorBorder = (field) => errors[field] ? 'border-red-500 focus:border-red-500 bg-red-50' : '';
    
    // Счетчики для входов
    const increment = (field, max = 100) => updateDetail(field, Math.min(max, (details[field] === '' ? 0 : details[field]) + 1));
    const decrement = (field, min = 1) => updateDetail(field, Math.max(min, (details[field] === '' ? min + 1 : details[field]) - 1));
    const renderCounterValue = (val) => (val === '' || val === undefined) ? <span className="text-red-300">?</span> : val;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* ЛЕВАЯ КОЛОНКА (Физика: Конструктив + Инженерия) */}
            <div className="lg:col-span-2 space-y-6">
                <ConstructiveCard 
                    details={details} 
                    updateDetail={updateDetail} 
                    errorBorder={errorBorder} 
                />
                <EngineeringCard 
                    details={details} 
                    updateDetail={updateDetail} 
                />
            </div>

            {/* ПРАВАЯ КОЛОНКА (Геометрия: Этажи + Подвал + Входы) */}
            <div className="space-y-6">
                <Card className="p-6 shadow-sm border-t-4 border-t-amber-500">
                     <SectionTitle icon={Box}>Параметры</SectionTitle>
                     
                     <div className="space-y-6 mt-4">
                         {/* Этажность */}
                         <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <ArrowUp size={16} className="text-amber-600"/> Этажность (Надземная)
                            </Label>
                            <Input 
                                type="number" 
                                min="1" 
                                max="3" 
                                placeholder="1-3"
                                value={details.floorsCount} 
                                onChange={updateFloorsCount} 
                                className={`font-bold text-lg ${errorBorder('floorsCount')}`}
                                disabled={isReadOnly}
                            />
                            <p className="text-[10px] text-slate-400">Максимум 3 этажа</p>
                         </div>

                         <div className="h-px bg-slate-100 w-full" />

                         {/* Входы */}
                         <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Footprints size={16} className="text-slate-400"/> Количество входов
                            </Label>
                            <div className="flex items-center gap-3">
                                <button disabled={isReadOnly} onClick={() => decrement('inputs', 1)} className="w-10 h-10 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-50 disabled:opacity-50">-</button>
                                <span className="font-bold text-xl w-8 text-center text-slate-700">{renderCounterValue(details.inputs)}</span>
                                <button disabled={isReadOnly} onClick={() => increment('inputs', 10)} className="w-10 h-10 bg-white border border-slate-200 rounded-lg font-bold hover:bg-slate-50 disabled:opacity-50">+</button>
                            </div>
                         </div>
                     </div>
                </Card>

                {/* Подвал */}
                <Card className="p-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                        <SectionTitle icon={ArrowDownToLine} className="mb-0">Подвал</SectionTitle>
                        <button 
                            disabled={isReadOnly || !canAddBasement} 
                            onClick={createBasement} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${canAddBasement && !isReadOnly ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'}`}
                        >
                            {canAddBasement ? '+ Добавить' : 'Макс. 3'}
                        </button>
                    </div>
                    
                    {blockBasements.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Нет подвальных помещений
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {blockBasements.map((base, idx) => (
                                <div key={base.id} className="p-3 bg-slate-800 rounded-xl text-white relative group shadow-sm flex items-center justify-between">
                                    <div className="flex gap-3 items-center">
                                        <div className="w-8 h-8 flex items-center justify-center bg-slate-700 border border-slate-600 rounded-lg text-xs font-bold text-slate-300">
                                            P-{idx+1}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Глубина</span>
                                            <div className="flex items-center gap-1">
                                                <input 
                                                    type="number" 
                                                    value={-base.depth} 
                                                    onChange={(e) => {
                                                        let val = parseInt(e.target.value);
                                                        if (isNaN(val)) val = -1;
                                                        if (val > 0) val = -val;
                                                        if (val > -1) val = -1;
                                                        if (val < -5) val = -5;
                                                        updateBasement(base.id, 'depth', Math.abs(val));
                                                    }} 
                                                    className="w-8 bg-transparent border-b border-slate-500 text-sm font-bold text-white text-center p-0 focus:border-white focus:outline-none"
                                                    disabled={isReadOnly}
                                                />
                                                <span className="text-xs text-slate-500">м</span>
                                            </div>
                                        </div>
                                    </div>
                                    {!isReadOnly && (
                                        <button onClick={()=>removeBasement(base.id)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                                            <X size={14}/>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}