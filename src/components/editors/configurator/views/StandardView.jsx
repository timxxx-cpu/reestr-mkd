import React, { useState, useMemo, useEffect } from 'react';
import { ImageIcon, Maximize, Settings2, Store, Layers, Lock, MapPin, AlertCircle, Building2, Plus, ArrowUpFromLine, ArrowDownToLine, X } from 'lucide-react';

// ИМПОРТЫ
import { useProject } from '../../../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, Button, TabButton, useReadOnly } from '../../../ui/UIKit';
import { getBlocksList } from '../../../../lib/utils';
import { Validators } from '../../../../lib/validators'; 
import { BuildingConfigSchema } from '../../../../lib/schemas';
import { useValidation } from '../../../../hooks/useValidation';

// Карточки
import ConstructiveCard from '../cards/ConstructiveCard';
import EngineeringCard from '../cards/EngineeringCard'; // <--- НОВАЯ КАРТОЧКА
import PhotoTab from '../PhotoTab';

export default function StandardView({ building, mode }) {
    const { buildingDetails, setBuildingDetails, complexInfo } = useProject();
    const isReadOnly = useReadOnly();
    
    const [activeTabId, setActiveTabId] = useState('photo'); 
    const blocksList = useMemo(() => getBlocksList(building), [building]);

    // Фильтрация
    const visibleBlocks = useMemo(() => {
        if (mode === 'res') return blocksList.filter(b => b.type === 'Ж');
        if (mode === 'nonres') return blocksList.filter(b => b.type !== 'Ж');
        return blocksList;
    }, [blocksList, mode]);

    useEffect(() => {
        const isActiveValid = activeTabId === 'photo' || visibleBlocks.some(b => b.id === activeTabId);
        if (!isActiveValid && visibleBlocks.length > 0) {
            setActiveTabId(visibleBlocks[0].id);
        } else if (visibleBlocks.length > 0 && activeTabId === 'photo') {
            setActiveTabId(visibleBlocks[0].id);
        }
    }, [visibleBlocks, activeTabId]);

    const currentBlock = blocksList.find(b => b.id === activeTabId);
    
    const detailsKey = currentBlock ? `${building.id}_${currentBlock.id}` : null;
    const featuresKey = `${building.id}_features`;
    const features = buildingDetails[featuresKey] || { basements: [], exploitableRoofs: [] };

    const defaultDetails = { 
        foundation: '', walls: '', slabs: '', roof: '', seismicity: '', 
        hasCustomAddress: false, customHouseNumber: '',
        floorsFrom: '', floorsTo: '', entrances: '', elevators: '', 
        commercialFloors: [], hasBasementFloor: false, hasAttic: false, hasLoft: false, 
        hasTechnicalFloor: false, technicalFloors: [], hasExploitableRoof: false, 
        parentBlocks: [], engineering: { hvs: false, gvs: false, heating: false, electricity: false, gas: false, sewerage: false, ventilation: false, firefighting: false, lowcurrent: false } 
    };

    const details = { ...defaultDetails, ...(buildingDetails[detailsKey] || {}) };
    const { errors } = useValidation(BuildingConfigSchema, details);

    const updateDetail = (key, val) => {
        if (isReadOnly) return;
        setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
    };

    const updateFeatures = (updates) => {
        if (isReadOnly) return;
        setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, ...updates } }));
    };

    useEffect(() => {
        if (currentBlock && currentBlock.type !== 'Ж' && !details.floorsFrom && !isReadOnly) {
            setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...prev[detailsKey], floorsFrom: 1 } }));
        }
    }, [currentBlock, details.floorsFrom, isReadOnly, detailsKey, setBuildingDetails]);

    const toggleParentBlock = (blockId) => {
        if (isReadOnly) return;
        const currentParents = details.parentBlocks || [];
        const newParents = currentParents.includes(blockId) 
            ? currentParents.filter(id => id !== blockId) 
            : [...currentParents, blockId];
        
        const updates = { parentBlocks: newParents };
        if (newParents.length > 0 && currentBlock.type === 'Н') {
            updates.hasAttic = false; updates.hasLoft = false; updates.hasExploitableRoof = false;
        }
        setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...prev[detailsKey], ...updates } }));
    };

    const toggleFloorAttribute = (targetList, value) => {
        if (isReadOnly) return;
        const currentTarget = details[targetList] || [];
        const newTarget = currentTarget.includes(value) ? currentTarget.filter(f => f !== value) : [...currentTarget, value];
        updateDetail(targetList, newTarget);
    };

    const blockBasements = (features.basements || []).filter(b => b.blocks?.includes(currentBlock?.id));
    const canAddBasement = blockBasements.length < 3;
    
    const createBlockBasement = () => {
        if (isReadOnly || !canAddBasement) return; 
        const newB = { id: crypto.randomUUID(), depth: 1, hasParking: false, parkingLevels: {}, blocks: [currentBlock.id], buildingId: building.id, blockId: currentBlock.id }; 
        updateFeatures({ basements: [...(features.basements || []), newB] }); 
    };
    
    const removeBasement = (id) => {
        if (isReadOnly) return;
        updateFeatures({ basements: (features.basements || []).filter(b => b.id !== id) });
    };

    const updateBasement = (id, field, val) => {
        if (isReadOnly) return;
        const updatedBasements = (features.basements || []).map(b => b.id === id ? { ...b, [field]: val } : b);
        updateFeatures({ basements: updatedBasements });
    };

    const stylobateHeightUnderCurrentBlock = useMemo(() => {
        if (currentBlock?.type !== 'Ж') return 0;
        let maxH = 0;
        blocksList.forEach(b => {
            if (b.type === 'Н') {
                const key = `${building.id}_${b.id}`;
                const bDetails = buildingDetails[key];
                if (bDetails?.parentBlocks?.includes(currentBlock.id)) {
                    const h = parseInt(bDetails.floorsTo) || 0;
                    if (h > maxH) maxH = h;
                }
            }
        });
        return maxH;
    }, [buildingDetails, blocksList, currentBlock, building.id]);

    const isResBasementLocked = useMemo(() => {
        if (currentBlock?.type !== 'Ж') return false;
        const stylobateBlock = blocksList.find(b => {
            if (b.type !== 'Н') return false;
            const key = `${building.id}_${b.id}`;
            const bDetails = buildingDetails[key];
            return bDetails?.parentBlocks?.includes(currentBlock.id);
        });
        if (!stylobateBlock) return false;
        const stylobateDetails = buildingDetails[`${building.id}_${stylobateBlock.id}`];
        return !!stylobateDetails?.hasBasementFloor;
    }, [blocksList, buildingDetails, currentBlock, building.id]);

    const occupiedResBlocks = useMemo(() => {
        const map = {};
        blocksList.forEach(b => {
            if (b.type === 'Н' && b.id !== currentBlock?.id) {
                const key = `${building.id}_${b.id}`;
                const otherDetails = buildingDetails[key];
                if (otherDetails?.parentBlocks) {
                    otherDetails.parentBlocks.forEach(parentId => { map[parentId] = b.tabLabel; });
                }
            }
        });
        return map;
    }, [buildingDetails, blocksList, currentBlock, building.id]);

    const localResBlocks = useMemo(() => blocksList.filter(b => b.type === 'Ж'), [blocksList]);

    const isCommercialValid = Validators.commercialPresence(building, buildingDetails, blocksList, mode);
    const hasElevatorIssue = Validators.elevatorRequirement(false, false, details.floorsTo, details.elevators || 0);
    const isResidentialBlock = currentBlock?.type === 'Ж';
    const isStylobate = currentBlock?.type === 'Н' && (details.parentBlocks || []).length > 0;
    const isFloorFromDisabled = currentBlock?.type !== 'Ж';
    const errorBorder = (field) => errors[field] ? 'border-red-500 focus:border-red-500 bg-red-50' : '';

    if (activeTabId === 'photo') return <PhotoTab building={building} />;
    if (!currentBlock) return null;

    const floorRange = Array.from({length: Math.min((parseInt(details.floorsTo)||1), 50) - (parseInt(details.floorsFrom)||1) + 1}, (_, i) => (parseInt(details.floorsFrom)||1) + i);
    
    const increment = (field, max = 100) => updateDetail(field, Math.min(max, (details[field] === '' ? 0 : details[field]) + 1));
    const decrement = (field, min = 1) => updateDetail(field, Math.max(min, (details[field] === '' ? min + 1 : details[field]) - 1));
    const renderCounterValue = (val) => (val === '' || val === undefined) ? <span className="text-red-300">?</span> : val;

    return (
        <>
            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max overflow-x-auto max-w-full mb-6 scrollbar-none">
                {visibleBlocks.map((block) => (
                    <TabButton key={block.id} active={activeTabId === block.id} onClick={() => setActiveTabId(block.id)}>{block.tabLabel}</TabButton>
                ))}
                <TabButton active={activeTabId === 'photo'} onClick={() => setActiveTabId('photo')}><ImageIcon size={14}/> Фасад</TabButton>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" key={currentBlock.id}>
                
                {/* --- ЛЕВАЯ КОЛОНКА (Физика: Конструктив + Инженерия) --- */}
                <div className="space-y-6">
                    <ConstructiveCard details={details} updateDetail={updateDetail} errorBorder={errorBorder} />
                    
                    {/* Новая карточка Инженерии */}
                    <EngineeringCard details={details} updateDetail={updateDetail} />
                </div>

                {/* --- ЦЕНТРАЛЬНАЯ И ПРАВАЯ КОЛОНКИ (Остальное) --- */}
                {/* Объединяем их в один блок col-span-2 для гибкости */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* КАРТОЧКА СТИЛОБАТА (ЕСЛИ ЭТО НЕЖИЛОЙ БЛОК) */}
                    {currentBlock.type === 'Н' && localResBlocks.length > 0 && (
                        <Card className="p-6 shadow-sm border-t-4 border-t-indigo-500">
                            <SectionTitle icon={Layers}>Расположение (Стилобат)</SectionTitle>
                            <div className="mt-4 space-y-2">
                                <Label>Находится под жилыми блоками:</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {localResBlocks.map(res => {
                                        const isSelected = (details.parentBlocks || []).includes(res.id);
                                        const occupiedBy = occupiedResBlocks[res.id]; 
                                        const isDisabled = !!occupiedBy && occupiedBy !== currentBlock.tabLabel;
                                        return (
                                            <button 
                                                disabled={isDisabled || isReadOnly} 
                                                key={res.id} 
                                                onClick={() => toggleParentBlock(res.id)} 
                                                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : isDisabled ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">{isDisabled ? <Lock size={14}/> : <Building2 size={14}/>}<div><span className="text-[10px] font-bold block">{res.tabLabel}</span>{isDisabled && <span className="text-[9px] text-red-400 block">Занят: {occupiedBy}</span>}</div></div>{isSelected && <div className="w-2 h-2 rounded-full bg-white shrink-0"/>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* ЭТАЖНОСТЬ */}
                    <Card className="p-6 shadow-sm">
                        <SectionTitle icon={Maximize}>Параметры этажности</SectionTitle>
                        <div className="grid grid-cols-2 gap-8 mb-6">
                            <div className="space-y-1">
                                <Label>С этажа</Label>
                                <Input type="number" min="1" value={details.floorsFrom} onChange={(e) => updateDetail('floorsFrom', e.target.value === '' ? '' : parseInt(e.target.value))} disabled={isReadOnly || isFloorFromDisabled} className={errorBorder('floorsFrom')}/>
                                {isFloorFromDisabled && <p className="text-[9px] text-slate-400">Фиксировано для нежилых</p>}
                            </div>
                            <div className="space-y-1">
                                <Label>По этаж</Label>
                                <Input type="number" min="1" max="50" value={details.floorsTo} onChange={(e) => updateDetail('floorsTo', e.target.value === '' ? '' : parseInt(e.target.value))} className={errorBorder('floorsTo')}/>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 mb-6">
                             {[{k: 'hasBasementFloor', l: 'Цокольный этаж', disabled: isResBasementLocked}, {k: 'hasAttic', l: 'Мансарда', disabled: isStylobate}, {k: 'hasLoft', l: 'Чердак', disabled: isStylobate}, {k: 'hasExploitableRoof', l: 'Эксплуатируемая крыша', disabled: isStylobate}].map(({k, l, disabled}) => (
                                 <label key={k} className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 ${disabled || isReadOnly ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-blue-300'}`}>
                                     <input disabled={disabled || isReadOnly} type="checkbox" checked={details[k] || false} onChange={(e)=>updateDetail(k,e.target.checked)} className="rounded text-blue-600 w-4 h-4 disabled:cursor-not-allowed"/>
                                     <span className="text-xs font-bold text-slate-600">{l}</span>
                                     {disabled && k === 'hasBasementFloor' && <span className="text-[8px] text-red-400 ml-auto">Занят</span>}
                                 </label>
                             ))}
                        </div>

                        {/* ТЕХ. ЭТАЖИ */}
                        <div className="mt-4 p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                            <div className="flex items-center gap-2 mb-3"><div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Settings2 size={16}/></div><div><Label className="text-amber-900">Вставка тех. этажей</Label><p className="text-[10px] text-amber-600/80 leading-tight">Выберите этаж, <b>НАД</b> которым нужно добавить тех.этаж</p></div></div>
                            <div className="flex flex-wrap gap-1.5">
                                {floorRange.map((f, idx) => { 
                                    const isTech = details.technicalFloors?.includes(f); 
                                    const isGap = (idx > 0) && (idx % 10 === 0); 
                                    const isLockedByStylobate = currentBlock.type === 'Ж' && f <= stylobateHeightUnderCurrentBlock; 
                                    const isDisabled = isLockedByStylobate || isReadOnly;
                                    return (<React.Fragment key={f}>{isGap && <div className="w-3"></div>}<button disabled={isDisabled} onClick={() => toggleFloorAttribute('technicalFloors', f)} className={`w-8 h-8 rounded-md text-xs font-bold shadow-sm transition-all border flex items-center justify-center gap-1 relative ${isLockedByStylobate ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : isTech ? 'bg-amber-50 border-amber-500 text-white' : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`} title={isLockedByStylobate ? 'Этаж занят стилобатом' : ''}>{f}{isLockedByStylobate ? <Lock size={8} className="absolute top-0.5 right-0.5 opacity-50"/> : (isTech ? <ArrowUpFromLine size={10}/> : <Plus size={10} className="opacity-50"/>)}</button></React.Fragment>) 
                                })}
                            </div>
                        </div>

                        {/* КОММЕРЦИЯ */}
                        {building.hasNonResPart && currentBlock.type === 'Ж' && (
                            <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 mb-4"><div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Store size={16}/></div><div><Label className="text-blue-900">Нежилые объекты (Коммерция)</Label><p className="text-[10px] text-blue-500/80 leading-tight">Отметьте этажи с нежилыми помещениями.</p></div></div>
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {blockBasements.map((b, idx) => {
                                        const val = `basement_${b.id}`; 
                                        const isActive = details.commercialFloors?.includes(val);
                                        return (<button disabled={isReadOnly} key={b.id} onClick={() => toggleFloorAttribute('commercialFloors', val)} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${isActive ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>P-{idx+1}</button>)
                                    })}
                                    {details.hasBasementFloor && (<button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', 'tsokol')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('tsokol') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Цоколь</button>)}
                                    {floorRange.map((f, idx) => { 
                                        const isComm = details.commercialFloors?.includes(f); 
                                        const isCommTech = details.commercialFloors?.includes(`${f}-Т`); 
                                        const isLockedByStylobate = f <= stylobateHeightUnderCurrentBlock; 
                                        const isDisabled = isLockedByStylobate || isReadOnly;
                                        return (<React.Fragment key={f}>{idx > 0 && idx % 10 === 0 && <div className="w-3"></div>}<button disabled={isDisabled} onClick={() => toggleFloorAttribute('commercialFloors', f)} className={`w-8 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${isLockedByStylobate ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : isComm ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`} title={isLockedByStylobate ? 'Этаж занят стилобатом' : ''}>{f}{isLockedByStylobate && <Lock size={8} className="absolute top-0.5 right-0.5 opacity-50"/>}</button>{details.technicalFloors?.includes(f) && (<button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', `${f}-Т`)} className={`px-1.5 h-8 rounded-md text-[10px] font-bold shadow-sm transition-all border flex items-center justify-center relative ${isCommTech ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-500 hover:bg-indigo-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`} title={`Отметить тех.этаж ${f}-Т как нежилой`}>{f}-Т</button>)}</React.Fragment>) 
                                    })}
                                    {details.hasAttic && (<button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', 'attic')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('attic') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Мансарда</button>)}
                                    {details.hasLoft && (<button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', 'loft')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('loft') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Чердак</button>)}
                                    {details.hasExploitableRoof && (<button disabled={isReadOnly} onClick={() => toggleFloorAttribute('commercialFloors', 'roof')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('roof') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'} ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Кровля</button>)}
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* ПОДВАЛ */}
                    <Card className="p-6 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4"><SectionTitle icon={ArrowDownToLine} className="mb-0">Подвал</SectionTitle><button disabled={isReadOnly || !canAddBasement} onClick={createBlockBasement} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${ canAddBasement && !isReadOnly ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'}`}>{canAddBasement ? '+ Добавить подвал' : 'Макс. 3 уровня'}</button></div>
                        {blockBasements.length === 0 ? (<div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">Подвальные помещения отсутствуют</div>) : (<div className="space-y-3">{blockBasements.map((base, idx) => (<div key={base.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 relative group text-white shadow-inner"><button disabled={isReadOnly} onClick={() => removeBasement(base.id)} className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition-all ${isReadOnly ? 'hidden' : ''}`}><X size={14}/></button><div className="flex gap-4 items-center"><div className="w-10 h-10 flex items-center justify-center bg-slate-700 border border-slate-600 rounded-lg font-bold text-slate-300 shadow-sm">P-{idx+1}</div><div className="flex flex-col gap-0.5"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Уровень {idx+1}</span><div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-300">Глубина:</span><input disabled={isReadOnly} type="number" value={-base.depth} onChange={(e) => { let val = parseInt(e.target.value); if (!isNaN(val)) updateBasement(base.id, 'depth', Math.abs(val)); }} className="w-14 text-center bg-slate-900 border border-slate-600 rounded text-sm font-bold text-white focus:border-blue-500 outline-none py-0.5 disabled:opacity-50"/></div></div></div></div>))}</div>)}
                    </Card>

                    {/* ОБЩИЕ И АДРЕС */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-6 shadow-sm"><SectionTitle icon={Settings2}>Общие</SectionTitle>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label>{currentBlock?.type === 'Ж' ? 'Подъездов' : 'Входов'} (макс. 30)</Label>
                                    <div className="flex items-center gap-3">
                                        <button disabled={isReadOnly} onClick={() => decrement('entrances', 1)} className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50">-</button>
                                        <span className="font-bold text-lg w-8 text-center">{renderCounterValue(details.entrances)}</span>
                                        <button disabled={isReadOnly} onClick={() => increment('entrances', 30)} className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50">+</button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label>Лифтов</Label>
                                    <div className="flex items-center gap-3">
                                        <button disabled={isReadOnly} onClick={() => decrement('elevators', 0)} className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50">-</button>
                                        <span className="font-bold text-lg w-8 text-center">{renderCounterValue(details.elevators)}</span>
                                        <button disabled={isReadOnly} onClick={() => increment('elevators')} className="w-8 h-8 bg-white border rounded font-bold hover:bg-slate-50">+</button>
                                    </div>
                                    {hasElevatorIssue && <div className="flex items-center gap-1 mt-1 text-[10px] text-red-500 font-bold animate-in fade-in"><AlertCircle size={10} /><span>Лифт обязателен &gt; 5 этажей</span></div>}
                                </div>
                            </div>
                        </Card>

                        {building.category === 'residential_multiblock' && (
                            <Card className="p-6 shadow-sm">
                                <SectionTitle icon={MapPin}>Адрес блока</SectionTitle>
                                <div className="space-y-4">
                                    <label className={`flex items-start gap-3 group ${isReadOnly ? 'opacity-50' : 'cursor-pointer'}`}>
                                        <input type="checkbox" checked={details.hasCustomAddress || false} onChange={(e) => updateDetail('hasCustomAddress', e.target.checked)} disabled={isReadOnly} className="mt-1 rounded text-blue-600 w-4 h-4"/>
                                        <div><span className="text-sm font-bold text-slate-700">У блока свой номер дома</span></div>
                                    </label>
                                    {details.hasCustomAddress && (<Input value={details.customHouseNumber || ''} onChange={(e) => updateDetail('customHouseNumber', e.target.value)} placeholder={building.houseNumber} />)}
                                </div>
                            </Card>
                        )}
                    </div>
                    
                    {/* АВТО-ЗАПОЛНЕНИЕ */}
                    <div className="flex flex-col gap-3">
                        {(isResidentialBlock && !isCommercialValid) && (<div className="text-[10px] text-red-500 bg-red-50 p-2 rounded text-center border border-red-100">Укажите коммерческие этажи хотя бы в одном жилом блоке</div>)}
                        <Button disabled={isReadOnly} variant="secondary" className="bg-purple-50 text-purple-600 border-purple-100">Авто-заполнение (В разработке)</Button>
                    </div>
                </div>
            </div>
        </>
    );
}