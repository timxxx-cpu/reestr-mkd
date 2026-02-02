import React from 'react';
import { Tent, Warehouse, Store, Car, ArrowDown, ArrowUp, Footprints, MapPin, Building2, Zap, ArrowDownToLine, ShieldCheck, X } from 'lucide-react';

// Импорты (пути проверены)
import { useProject } from '../../../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, useReadOnly } from '../../../ui/UIKit';
import { BuildingConfigSchema } from '../../../../lib/schemas';
import { useValidation } from '../../../../hooks/useValidation';

// Карточки
import ConstructiveCard from '../cards/ConstructiveCard';
import EngineeringCard from '../cards/EngineeringCard';

export default function ParkingView({ building, typeInfo }) {
    const { buildingDetails, setBuildingDetails, composition } = useProject();
    const isReadOnly = useReadOnly();
    
    // Типы паркинга из хука
    const { isGroundOpen, isGroundLight, isCapitalStructure, isUnderground } = typeInfo;

    const detailsKey = `${building.id}_main`; 
    const featuresKey = `${building.id}_features`;
    
    const features = buildingDetails[featuresKey] || { basements: [] };
    
    // ИНИЦИАЛИЗАЦИЯ: Пустые значения для обязательных полей
    const defaultDetails = { 
        foundation: '', walls: '', slabs: '', roof: '', seismicity: '', 
        levelsDepth: '',      // Обязательно для подземного
        floorsCount: '',      // Обязательно для наземного капитального
        lightStructureType: '', // Обязательно для легкого
        vehicleEntries: 1, inputs: 1, elevators: 0,
        parentBlocks: [], 
        engineering: { electricity: false, firefighting: false, ventilation: false, hvs: false, heating: false } 
    };

    const details = { ...defaultDetails, ...(buildingDetails[detailsKey] || {}) };
    const { errors } = useValidation(BuildingConfigSchema, details);

    // --- ЛОГИКА ОБНОВЛЕНИЯ ---
    const updateDetail = (key, val) => {
        if (isReadOnly) return;
        setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
    };

    const updateFeatures = (updates) => {
        if (isReadOnly) return;
        setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, ...updates } }));
    };

    // --- ПОДВАЛ (Только для наземного капитального) ---
    const blockBasements = (features.basements || []).filter(b => b.blockId === 'main' || b.blocks?.includes('main'));
    const canAddBasement = blockBasements.length < 1; // Макс 1 уровень подвала для паркинга

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

    // --- РОДИТЕЛЬСКИЕ БЛОКИ (Для подземного) ---
    const availableParents = composition.filter(c => c.id !== building.id && c.category.includes('residential'));
    
    const toggleParentBlock = (blockId) => {
        if (isReadOnly) return;
        const currentParents = details.parentBlocks || [];
        const newParents = currentParents.includes(blockId) 
            ? currentParents.filter(id => id !== blockId) 
            : [...currentParents, blockId];
        updateDetail('parentBlocks', newParents);
    };

    // Хелперы UI
    const errorBorder = (field) => errors[field] ? 'border-red-500 focus:border-red-500 bg-red-50' : '';
    
    const increment = (field, max = 100) => updateDetail(field, Math.min(max, (parseInt(details[field]) || 0) + 1));
    const decrement = (field, min = 1) => updateDetail(field, Math.max(min, (parseInt(details[field]) || 0) - 1));
    const renderCounterValue = (val) => (val === '' || val === undefined) ? <span className="text-red-300">?</span> : val;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* --- ЛЕВАЯ КОЛОНКА: Специфичные настройки типа --- */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* 1. ОТКРЫТАЯ СТОЯНКА */}
                {isGroundOpen && (
                    <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center">
                        <div className="p-4 bg-slate-50 rounded-full text-slate-300 mb-4"><Car size={48} /></div>
                        <h3 className="text-xl font-bold text-slate-700">Открытая площадка</h3>
                        <p className="text-slate-500 max-w-sm mt-2">Для открытого типа паркинга нет дополнительных параметров конфигурации.</p>
                    </Card>
                )}

                {/* 2. ЛЕГКИЕ КОНСТРУКЦИИ (Навесы) */}
                {isGroundLight && (
                    <Card className="p-6 shadow-sm border-t-4 border-t-indigo-500">
                        <SectionTitle icon={Tent}>Легкие конструкции</SectionTitle>
                        <div className="space-y-4 mt-6">
                            <Label>Тип конструкции <span className="text-red-500">*</span></Label>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    disabled={isReadOnly} 
                                    onClick={() => updateDetail('lightStructureType', 'canopy')} 
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${details.lightStructureType === 'canopy' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Warehouse size={24} /><span className="font-bold">Навесы</span>
                                </button>
                                <button 
                                    disabled={isReadOnly} 
                                    onClick={() => updateDetail('lightStructureType', 'box')} 
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${details.lightStructureType === 'box' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Store size={24} /><span className="font-bold">Боксы / Гаражи</span>
                                </button>
                            </div>
                            {errors.lightStructureType && <span className="text-[10px] text-red-500 font-bold block mt-1">Выберите тип конструкции</span>}
                        </div>
                    </Card>
                )}

                {/* 3. КАПИТАЛЬНЫЙ (Подземный или Наземный) */}
                {isCapitalStructure && (
                    <Card className="p-6 shadow-sm border-t-4 border-t-slate-500">
                        <SectionTitle icon={Car}>Параметры паркинга</SectionTitle>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                            <div className="space-y-6">
                                {/* Подземный: Глубина */}
                                {isUnderground ? (
                                    <div className="space-y-3">
                                        <Label className="flex items-center gap-2">
                                            <ArrowDown size={16} className="text-blue-600"/> Уровней вниз <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4].map(lvl => (
                                                <button 
                                                    key={lvl} 
                                                    disabled={isReadOnly} 
                                                    onClick={() => updateDetail('levelsDepth', lvl)} 
                                                    className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all ${details.levelsDepth === lvl ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    -{lvl}
                                                </button>
                                            ))}
                                        </div>
                                        {errors.levelsDepth && <span className="text-[10px] text-red-500 font-bold">Выберите глубину</span>}
                                    </div>
                                ) : (
                                    /* Наземный: Высота и Подвал */
                                    <>
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2"><ArrowUp size={16} className="text-blue-600"/> Этажей вверх</Label>
                                            <Input 
                                                type="number" min="1" max="10" 
                                                value={details.floorsCount} 
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') { updateDetail('floorsCount', ''); return; }
                                                    updateDetail('floorsCount', parseInt(val));
                                                }}
                                                className={errorBorder('floorsCount')}
                                                disabled={isReadOnly}
                                            />
                                        </div>
                                        
                                        {/* Подвал для наземного */}
                                        <div className="pt-2">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                                <Label className="flex items-center gap-2"><ArrowDownToLine size={14}/> Подвал</Label>
                                                <button disabled={isReadOnly || !canAddBasement} onClick={createBasement} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${ canAddBasement && !isReadOnly ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'}`}>{canAddBasement ? '+ Добавить' : 'Макс. 1'}</button>
                                            </div>
                                            {blockBasements.map((base, idx) => (
                                                <div key={base.id} className="p-3 bg-slate-800 rounded-lg text-white mb-2 relative group flex items-center justify-between">
                                                    <div className="flex gap-3 items-center">
                                                        <div className="w-8 h-8 flex items-center justify-center bg-slate-700 border border-slate-600 rounded font-bold text-xs">P-{idx+1}</div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-400">Глубина:</span>
                                                            <input disabled={isReadOnly} type="number" value={-base.depth} onChange={(e) => { let val = parseInt(e.target.value); if (!isNaN(val)) updateBasement(base.id, 'depth', Math.abs(val)); }} className="w-10 text-center bg-slate-900 border border-slate-600 rounded text-[10px] font-bold text-white outline-none py-0.5"/>
                                                        </div>
                                                    </div>
                                                    {!isReadOnly && <button onClick={() => removeBasement(base.id)} className="text-slate-400 hover:text-white"><X size={14}/></button>}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Въезды и Входы */}
                            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="space-y-1">
                                    <Label className="flex items-center gap-2"><Car size={14} /> Въезды (авто)</Label>
                                    <div className="flex items-center gap-3">
                                        <button disabled={isReadOnly} onClick={() => decrement('vehicleEntries', 1)} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-50">-</button>
                                        <span className="font-bold text-lg w-8 text-center">{renderCounterValue(details.vehicleEntries)}</span>
                                        <button disabled={isReadOnly} onClick={() => increment('vehicleEntries')} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-50">+</button>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-200 w-full" />
                                <div className="space-y-1">
                                    <Label className="flex items-center gap-2"><Footprints size={14} /> Входы (люди)</Label>
                                    <div className="flex items-center gap-3">
                                        <button disabled={isReadOnly} onClick={() => decrement('inputs', 0)} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-50">-</button>
                                        <span className="font-bold text-lg w-8 text-center">{renderCounterValue(details.inputs)}</span>
                                        <button disabled={isReadOnly} onClick={() => increment('inputs')} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-50">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Для подземного: Привязка к домам */}
                        {isUnderground && (
                            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <Label className="flex items-center gap-2 mb-3 text-blue-800"><MapPin size={14}/> Расположен под блоками:</Label>
                                {availableParents.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                                        {availableParents.map(parent => {
                                            const isSelected = (details.parentBlocks || []).includes(parent.id);
                                            return (
                                                <button 
                                                    disabled={isReadOnly} 
                                                    key={parent.id} 
                                                    onClick={() => toggleParentBlock(parent.id)} 
                                                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-blue-200 text-slate-600 hover:border-blue-400'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`font-black text-xs px-1.5 py-0.5 rounded border border-white/20 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{parent.houseNumber}</div>
                                                        <span className="text-[11px] font-bold line-clamp-1">{parent.label}</span>
                                                    </div>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white shrink-0"/>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center text-[10px] text-slate-400 py-4 border border-dashed rounded-lg bg-white">Нет подходящих зданий</div>
                                )}
                            </div>
                        )}
                    </Card>
                )}
            </div>

            {/* --- ПРАВАЯ КОЛОНКА: Конструктив и Инженерия --- */}
            <div className="space-y-6">
                
                {/* Конструктив нужен ТОЛЬКО для капитальных строений */}
                {isCapitalStructure && (
                    <ConstructiveCard 
                        details={details} 
                        updateDetail={updateDetail} 
                        errorBorder={errorBorder} 
                    />
                )}

                {/* Инженерия нужна, если это не открытая стоянка */}
                {(!isGroundOpen) && (
                    <EngineeringCard 
                        details={details} 
                        updateDetail={updateDetail} 
                    />
                )}
            </div>
        </div>
    );
}