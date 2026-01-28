import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wand2, Save, ImageIcon, Hammer, Maximize, 
  ArrowDownToLine, X, Zap, Settings2, Trash2, Droplets, 
  Thermometer, Flame, Wind, ShieldCheck, Wifi, Store, Layers,
  Fan, Plug, ArrowUpFromLine, Plus, AlertCircle, Car, Footprints,
  ArrowDown, ArrowUp, Building2, Warehouse, Tent, Box, MapPin, Lock
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, Select, Button, TabButton } from '../ui/UIKit';
import SaveFloatingBar from '../ui/SaveFloatingBar'; 
import { getBlocksList, calculateProgress, getStageColor } from '../../lib/utils';
import { Validators } from '../../lib/validators'; 
import { BuildingConfigSchema } from '../../lib/schemas';
import { useValidation } from '../../hooks/useValidation';
// [NEW] Импорт нового хука
import { useBuildingType } from '../../hooks/useBuildingType';

const PARKING_TYPE_LABELS = {
    capital: "Капитальный",
    light: "Легкие конструкции",
    open: "Открытый"
};

/**
 * @param {{ buildingId: string, mode?: 'all'|'res'|'nonres', onBack: () => void }} props
 */
export default function BuildingConfigurator({ buildingId, mode = 'all', onBack }) {
    const { composition, buildingDetails, setBuildingDetails, saveData } = useProject();
    
    const building = useMemo(() => composition.find(c => c.id === buildingId), [composition, buildingId]);
    
    // [NEW] Использование хука для определения типов
    const { 
        isParking, isInfrastructure, isUnderground, 
        isGroundLight, isGroundOpen, isCapitalStructure 
    } = useBuildingType(building);

    const [activeTabId, setActiveTabId] = useState('photo'); 
    const [photoUrlInput, setPhotoUrlInput] = useState('');

    const blocksList = useMemo(() => getBlocksList(building), [building]);
  
    // Доступные блоки (пятно застройки) для подземного паркинга
    const availableParents = useMemo(() => {
        if (!isUnderground) return [];
        return composition.filter(c => c.id !== building.id && c.category.includes('residential'));
    }, [composition, building.id, isUnderground]);

    const visibleBlocks = useMemo(() => {
        if (!building) return [];
        if (mode === 'res') return blocksList.filter(b => b.type === 'Ж');
        if (mode === 'nonres') return blocksList.filter(b => b.type !== 'Ж');
        return blocksList;
    }, [blocksList, mode, building]);

    useEffect(() => {
        if (!isParking && !isInfrastructure) {
            if (visibleBlocks.length > 0 && activeTabId === 'photo') {
                setActiveTabId(visibleBlocks[0].id);
            } else if (visibleBlocks.length > 0 && !visibleBlocks.find(b => b.id === activeTabId)) {
                setActiveTabId(visibleBlocks[0].id);
            }
        }
    }, [visibleBlocks.length, mode, isParking, isInfrastructure]);

    if (!building) return <div className="p-8 text-center">Объект не найден</div>;

    // --- ЛОГИКА ДАННЫХ ---
    let currentBlock = blocksList.find(b => b.id === activeTabId);
    if (isParking) currentBlock = { id: 'main', type: 'Паркинг', index: 0, fullId: 'main', tabLabel: 'Паркинг', icon: Car };
    if (isInfrastructure) currentBlock = { id: 'main', type: 'Инфра', index: 0, fullId: 'main', tabLabel: 'Инфра', icon: Box };

    const currentBlockId = currentBlock?.id;
    const detailsKey = currentBlockId ? `${building.id}_${currentBlockId}` : null;
    const featuresKey = `${building.id}_features`;

    /** @type {any} */
    const features = buildingDetails[featuresKey] || { basements: [], exploitableRoofs: [] };
    
    // Дефолтные значения
    const defaultDetails = { 
        foundation: 'Монолитная плита', walls: 'Кирпич', slabs: 'Монолитные ж/б', roof: 'Плоская рулонная', 
        floorsFrom: 1, floorsTo: 1, entrances: 1, inputs: 1, vehicleEntries: 1, elevators: 0, 
        commercialFloors: [], hasBasementFloor: false, hasAttic: false, hasLoft: false, 
        hasTechnicalFloor: false, technicalFloors: [], hasExploitableRoof: false, 
        placementType: 'attached', 
        parentBlocks: [], 
        levelsDepth: 1, 
        floorsCount: 1, 
        lightStructureType: 'canopy', 
        engineering: { hvs: true, gvs: true, heating: true, electricity: true, gas: false, sewerage: true, ventilation: true, firefighting: true, lowcurrent: true } 
    };

    /** @type {import('../../lib/types').BuildingConfig} */
    const details = { ...defaultDetails, ...(buildingDetails[detailsKey] || {}) };

    // ПОДКЛЮЧЕНИЕ ВАЛИДАЦИИ
    const { errors, isValid } = useValidation(BuildingConfigSchema, details);

    /** @type {(key: string, val: any) => void} */
    const updateDetail = (key, val) => setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
    
    /** @type {(updates: any) => void} */
    const updateFeatures = (updates) => setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, ...updates } }));
    
    // --- РАСЧЕТЫ ДЛЯ СТИЛОБАТА ---
    const stylobateHeightUnderCurrentBlock = useMemo(() => {
        if (currentBlock?.type !== 'Ж') return 0;
        let maxH = 0;
        blocksList.forEach(b => {
            if (b.type === 'Н') {
                const key = `${building.id}_${b.id}`;
                const bDetails = buildingDetails[key];
                if (bDetails?.parentBlocks?.includes(currentBlock.id)) {
                    const h = bDetails.floorsTo || 0;
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

    useEffect(() => {
        if (isResBasementLocked && details.hasBasementFloor) {
            updateDetail('hasBasementFloor', false);
        }
    }, [isResBasementLocked, details.hasBasementFloor]);

    const occupiedResBlocks = useMemo(() => {
        const map = {};
        blocksList.forEach(b => {
            if (b.type === 'Н' && b.id !== currentBlock?.id) {
                const key = `${building.id}_${b.id}`;
                const otherDetails = buildingDetails[key];
                if (otherDetails && otherDetails.parentBlocks) {
                    otherDetails.parentBlocks.forEach(parentId => {
                        map[parentId] = b.tabLabel; 
                    });
                }
            }
        });
        return map;
    }, [buildingDetails, blocksList, currentBlock, building.id]);

    const localResBlocks = useMemo(() => blocksList.filter(b => b.type === 'Ж'), [blocksList]);

    /** @type {(id: number, field: string, val: any) => void} */
    const updateBasement = (id, field, val) => {
        // @ts-ignore
        const updatedBasements = (features.basements || []).map(b => b.id === id ? { ...b, [field]: val } : b);
        updateFeatures({ basements: updatedBasements });
    };
    
    // @ts-ignore
    const blockBasements = (features.basements || []).filter(b => b.blocks?.includes(currentBlock?.id));
    const canAddBasement = blockBasements.length < 3;
    
    /** @type {() => void} */
    const createBlockBasement = () => {
        if (!canAddBasement) return; 
        const newB = { id: crypto.randomUUID(), depth: 1, hasParking: false, parkingLevels: {}, blocks: [currentBlock.id] }; 
        // @ts-ignore
        updateFeatures({ basements: [...(features.basements || []), newB] }); 
    };
    
    /** @type {(id: number) => void} */
    // @ts-ignore
    const removeBasement = (id) => updateFeatures({ basements: (features.basements || []).filter(b => b.id !== id) });
    
    const floorRange = useMemo(() => {
        const from = details.floorsFrom || 1;
        const to = details.floorsTo || 1;
        const safeTo = Math.min(to, 50); 
        return Array.from({length: safeTo - from + 1}, (_, i) => from + i);
    }, [details.floorsFrom, details.floorsTo]);

    /** @type {(targetList: string, value: any) => void} */
    const toggleFloorAttribute = (targetList, value) => {
        // @ts-ignore
        const currentTarget = details[targetList] || [];
        const newTarget = currentTarget.includes(value) ? currentTarget.filter(f => f !== value) : [...currentTarget, value];
        updateDetail(targetList, newTarget);
    };

    /** @type {(blockId: string) => void} */
    const toggleParentBlock = (blockId) => {
        const currentParents = details.parentBlocks || [];
        const newParents = currentParents.includes(blockId) 
            ? currentParents.filter(id => id !== blockId) 
            : [...currentParents, blockId];
        
        const updates = { parentBlocks: newParents };
        if (newParents.length > 0 && currentBlock.type === 'Н') {
            // @ts-ignore
            updates.hasAttic = false;
            // @ts-ignore
            updates.hasLoft = false;
            // @ts-ignore
            updates.hasExploitableRoof = false;
        }
        setBuildingDetails(prev => ({
            ...prev,
            [detailsKey]: { ...prev[detailsKey], ...updates }
        }));
    };

    const autoFillConfig = () => { alert('Авто-конфиг доступен для жилых домов'); };

    const engineeringSystems = [
        { id: 'hvs', label: 'ХВС', icon: Droplets, color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
        { id: 'gvs', label: 'ГВС', icon: Droplets, color: 'text-cyan-600 bg-cyan-50 border-cyan-200 hover:bg-cyan-100' },
        { id: 'sewerage', label: 'Канализ.', icon: ArrowDownToLine, color: 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200' },
        { id: 'heating', label: 'Отопл.', icon: Thermometer, color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
        { id: 'electricity', label: 'Электро', icon: Zap, color: 'text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100' },
        { id: 'lowcurrent', label: 'Слаботоч.', icon: Wifi, color: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
        { id: 'ventilation', label: 'Вент.', icon: Fan, color: 'text-teal-600 bg-teal-50 border-teal-200 hover:bg-teal-100' },
        { id: 'firefighting', label: 'Пож.', icon: ShieldCheck, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
    ];
    if (!isParking) engineeringSystems.splice(4, 0, { id: 'gas', label: 'Газ', icon: Flame, color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' });

    // --- ВАЛИДАЦИЯ И ОШИБКИ ---
    const isCommercialValid = Validators.commercialPresence(building, buildingDetails, blocksList, mode);
    const hasElevatorIssue = Validators.elevatorRequirement(isParking, isInfrastructure, details.floorsTo, details.elevators || 0);
    
    const isResidentialBlock = currentBlock?.type === 'Ж';

    const hasCriticalErrors = isResidentialBlock 
        ? (!isValid || hasElevatorIssue || !isCommercialValid)
        : !isValid;

    const isFloorFromDisabled = currentBlock?.type === 'Ж' || currentBlock?.type === 'Н';
    const isStylobate = currentBlock?.type === 'Н' && (details.parentBlocks || []).length > 0;

    const ErrorBorder = (field) => errors[field] ? 'border-red-500 focus:border-red-500 bg-red-50' : '';

    const handleSave = async () => {
        await saveData({}, true); 
    };

    return (
        <div className="animate-in slide-in-from-bottom duration-500 space-y-6 pb-20 max-w-7xl mx-auto w-full">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    {isParking ? <Car size={140}/> : isInfrastructure ? <Box size={140}/> : <Building2 size={140}/>}
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
                    <div className="flex gap-5">
                        <button onClick={onBack} className="mt-1 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors h-min">
                            <ArrowLeft size={24}/>
                        </button>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStageColor(building.stage)}`}>
                                    {building.stage || 'Проект'}
                                </span>
                                <span className="text-xs font-bold text-slate-400">ID: {building.id.slice(-6)}</span>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">{building.label}</h1>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                                <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Дом №</span><span className="font-bold bg-slate-100 px-2 py-0.5 rounded">{building.houseNumber}</span></div>
                                <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Тип</span><span className="font-medium">{building.type}</span></div>
                                {isParking && <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Вид</span><span className="font-medium">{isUnderground ? 'Подземный' : 'Наземный'} {building.constructionType && ` • ${PARKING_TYPE_LABELS[building.constructionType] || building.constructionType}`}</span></div>}
                                {isInfrastructure && <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">Вид</span><span className="font-medium">{building.infraType || 'Не указан'}</span></div>}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={onBack}>Закрыть</Button>
                    </div>
                </div>
            </div>

            {isParking ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                         {isGroundOpen && (<Card className="p-12 border-dashed flex flex-col items-center justify-center text-center"><div className="p-4 bg-slate-50 rounded-full text-slate-300 mb-4"><Car size={48} /></div><h3 className="text-xl font-bold text-slate-700">Открытая площадка</h3><p className="text-slate-500 max-w-sm mt-2">Для открытого типа паркинга нет дополнительных параметров конфигурации.</p></Card>)}
                         {isGroundLight && (
                            <Card className="p-6 shadow-sm border-t-4 border-t-indigo-500">
                                <SectionTitle icon={Tent}>Легкие конструкции</SectionTitle>
                                <div className="space-y-4 mt-6">
                                    <Label>Тип конструкции</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => updateDetail('lightStructureType', 'canopy')} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${details.lightStructureType === 'canopy' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'}`}><Warehouse size={24} /><span className="font-bold">Навесы</span></button>
                                        <button onClick={() => updateDetail('lightStructureType', 'box')} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${details.lightStructureType === 'box' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300'}`}><Store size={24} /><span className="font-bold">Боксы / Гаражи</span></button>
                                    </div>
                                    <p className="text-[10px] text-slate-400">Для данного типа паркинга этажность и подъезды не учитываются.</p>
                                </div>
                            </Card>
                         )}
                         {isCapitalStructure && (
                            <Card className="p-6 shadow-sm border-t-4 border-t-slate-500">
                                <SectionTitle icon={Car}>Параметры паркинга</SectionTitle>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                                    <div className="space-y-4">
                                        {isUnderground ? (
                                            <>
                                                <div className="space-y-2">
                                                    <Label className="flex items-center gap-2"><ArrowDown size={16} className="text-blue-600"/> Количество уровней (вниз)</Label>
                                                    <div className="flex gap-2">
                                                        {[1, 2, 3, 4].map(lvl => (<button key={lvl} onClick={() => updateDetail('levelsDepth', lvl)} className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all ${(details.levelsDepth || 1) === lvl ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>-{lvl}</button>))}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-4">
                                                    <Label className="flex items-center gap-2 mb-3"><MapPin size={14}/> Расположен под блоками:</Label>
                                                    {availableParents.length > 0 ? (
                                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                                                            {availableParents.map(parent => {
                                                                const isSelected = (details.parentBlocks || []).includes(parent.id);
                                                                const Icon = parent.icon || Building2;
                                                                return (<button key={parent.id} onClick={() => toggleParentBlock(parent.id)} className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}><div className="flex items-center gap-3 overflow-hidden"><div className={`font-black text-xs px-1.5 py-0.5 rounded border border-slate-200/20 shrink-0 ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{parent.houseNumber}</div><div className="flex flex-col overflow-hidden"><span className="text-[10px] font-bold line-clamp-1">{parent.label}</span><div className="flex items-center gap-1 opacity-70"><Icon size={10}/><span className="text-[9px]">{parent.subLabel}</span></div></div></div>{isSelected && <div className="w-2 h-2 rounded-full bg-white shrink-0"/>}</button>)
                                                            })}
                                                        </div>
                                                    ) : (<div className="text-center text-[10px] text-slate-400 py-4 border border-dashed rounded-lg bg-slate-50">Нет подходящих зданий</div>)}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="flex items-center gap-2"><ArrowUp size={16} className="text-blue-600"/> Количество этажей (вверх)</Label>
                                                    <Input type="number" min="1" max="10" value={details.floorsCount} onChange={(e) => { const val = e.target.value; if (val === '') { updateDetail('floorsCount', ''); return; } let num = parseInt(val); if (num > 10) num = 10; updateDetail('floorsCount', num); }} className="font-bold text-lg"/>
                                                    <p className="text-[10px] text-slate-400 mt-1">Максимум 10 этажей для капитального паркинга.</p>
                                                </div>
                                                <div className="pt-2">
                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                                                        <Label className="flex items-center gap-2"><ArrowDownToLine size={14}/> Подвал</Label>
                                                        <button onClick={createBlockBasement} disabled={!canAddBasement} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${ canAddBasement ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'}`}>{canAddBasement ? '+ Добавить' : 'Макс. 3'}</button>
                                                    </div>
                                                    {blockBasements.length === 0 ? (<div className="text-center py-3 text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">Нет подвала</div>) : (<div className="space-y-2">{blockBasements.map((base, idx) => (<div key={base.id} className="p-3 bg-slate-800 rounded-lg border border-slate-700 relative group text-white shadow-inner"><button onClick={() => removeBasement(base.id)} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-slate-700 p-0.5 rounded transition-all"><X size={12}/></button><div className="flex gap-3 items-center"><div className="w-8 h-8 flex items-center justify-center bg-slate-700 border border-slate-600 rounded font-bold text-slate-300 text-xs">P-{idx+1}</div><div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Уровень {idx+1}</span><div className="flex items-center gap-2"><span className="text-[10px] font-medium text-slate-300">Глубина:</span><input type="number" value={-base.depth} onChange={(e) => { let val = parseInt(e.target.value); if (isNaN(val)) val = -1; if (val > 0) val = -val; if (val > -1) val = -1; if (val < -4) val = -4; updateBasement(base.id, 'depth', Math.abs(val)); }} className="w-10 text-center bg-slate-900 border border-slate-600 rounded text-[10px] font-bold text-white outline-none py-0.5"/></div></div></div></div>))}</div>)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="space-y-1"><Label className="flex items-center gap-2"><Car size={14} /> Въезды (для авто)</Label><div className="flex items-center gap-3"><button onClick={() => updateDetail('vehicleEntries', Math.max(1, (details.vehicleEntries||1) - 1))} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100">-</button><span className="font-bold text-lg w-8 text-center">{details.vehicleEntries || 1}</span><button onClick={() => updateDetail('vehicleEntries', (details.vehicleEntries||1) + 1)} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100">+</button></div></div><div className="h-px bg-slate-200 w-full" /><div className="space-y-1"><Label className="flex items-center gap-2"><Footprints size={14} /> Входы (для людей)</Label><div className="flex items-center gap-3"><button onClick={() => updateDetail('inputs', Math.max(0, (details.inputs||1) - 1))} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100">-</button><span className="font-bold text-lg w-8 text-center">{details.inputs || 1}</span><button onClick={() => updateDetail('inputs', (details.inputs||1) + 1)} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100">+</button></div></div>
                                    </div>
                                </div>
                            </Card>
                         )}
                    </div>
                    <div className="space-y-6">
                        {isCapitalStructure && (<Card className="p-5 shadow-sm"><SectionTitle icon={Hammer}>Конструктив</SectionTitle><div className="space-y-4"><div className="grid grid-cols-1 gap-3">{['foundation:Фундамент:Монолитная плита,Свайный', 'walls:Стены:Монолитный ж/б,Кирпич,Блок', 'slabs:Перекрытия:Монолитные ж/б,Сборные плиты', 'roof:Крыша:Плоская рулонная,Скатная,Эксплуатируемая'].map(field => { const [key, label, opts] = field.split(':'); return <div key={key} className="space-y-1"><Label>{label}</Label><Select className="text-xs py-1.5" value={details[key]} onChange={(e)=>updateDetail(key, e.target.value)}>{opts.split(',').map(o=><option key={o}>{o}</option>)}</Select></div>; })}</div><div className="pt-4 border-t border-slate-100"><Label>Лифтов</Label><div className="flex items-center gap-3 mt-1"><button onClick={() => updateDetail('elevators', Math.max(0, (details.elevators||0) - 1))} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100">-</button><span className="font-bold text-lg w-8 text-center">{details.elevators || 0}</span><button onClick={() => updateDetail('elevators', (details.elevators||0) + 1)} className="w-8 h-8 bg-white rounded border border-slate-200 font-bold hover:bg-slate-100">+</button></div></div></div></Card>)}
                        {(!isGroundOpen) && (<Card className="p-6 shadow-sm"><SectionTitle icon={Zap}>Инженерия</SectionTitle><div className="space-y-2 mt-4">{engineeringSystems.map(sys => { if (['gas', 'lowcurrent'].includes(sys.id)) return null; if (isGroundLight && !['electricity', 'firefighting'].includes(sys.id)) return null; const isActive = details.engineering?.[sys.id]; const Icon = sys.icon; return (<button key={sys.id} onClick={() => updateDetail('engineering', {...details.engineering, [sys.id]: !isActive})} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isActive ? sys.color + ' shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}><div className="flex items-center gap-3"><Icon size={18} /><span className="text-xs font-bold uppercase">{sys.label}</span></div><div className={`w-4 h-4 rounded border flex items-center justify-center ${isActive ? 'bg-white border-transparent' : 'border-slate-300'}`}>{isActive && <div className="w-2 h-2 rounded-full bg-current"/>}</div></button>) })}</div></Card>)}
                    </div>
                </div>
            ) : isInfrastructure ? (
                // --- ВЕТВЛЕНИЕ: ИНФРАСТРУКТУРА ---
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="p-6 shadow-sm border-t-4 border-t-amber-500">
                             <SectionTitle icon={Box}>Параметры объекта</SectionTitle>
                             <div className="mt-6 space-y-6">
                                 <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2"><ArrowUp size={16} className="text-amber-600"/> Количество этажей</Label>
                                        <Input type="number" min="1" max="3" value={details.floorsCount} onChange={(e) => { const val = e.target.value; if (val === '') { updateDetail('floorsCount', ''); return; } let num = parseInt(val); if (num > 3) num = 3; setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...prev[detailsKey], floorsCount: num, floorsFrom: 1 } })); }} className="font-bold text-lg"/>
                                        <p className="text-[10px] text-slate-400 mt-1">Максимум 3 этажа для объекта инфраструктуры.</p>
                                    </div>
                                 </div>
                                 <div className="pt-4 border-t border-slate-100">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4"><SectionTitle icon={ArrowDownToLine} className="mb-0">Подвал</SectionTitle><button onClick={createBlockBasement} disabled={!canAddBasement} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${ canAddBasement ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'}`}>{canAddBasement ? '+ Добавить' : 'Макс. 3'}</button></div>
                                    {blockBasements.length === 0 ? (<div className="text-center py-4 text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">Подвальные помещения отсутствуют</div>) : (<div className="space-y-2">{blockBasements.map((base, idx) => (<div key={base.id} className="p-3 bg-slate-800 rounded-lg border border-slate-700 relative group text-white shadow-inner"><button onClick={() => removeBasement(base.id)} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-slate-700 p-0.5 rounded transition-all"><X size={12}/></button><div className="flex gap-3 items-center"><div className="w-8 h-8 flex items-center justify-center bg-slate-700 border border-slate-600 rounded font-bold text-slate-300 text-xs">P-{idx+1}</div><div className="flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Уровень {idx+1}</span><div className="flex items-center gap-2"><span className="text-[10px] font-medium text-slate-300">Глубина:</span><input type="number" value={-base.depth} onChange={(e) => { let val = parseInt(e.target.value); if (isNaN(val)) val = -1; if (val > 0) val = -val; if (val > -1) val = -1; if (val < -4) val = -4; updateBasement(base.id, 'depth', Math.abs(val)); }} className="w-10 text-center bg-slate-900 border border-slate-600 rounded text-sm font-bold text-white outline-none py-0.5"/></div></div></div></div>))}</div>)}
                                 </div>
                             </div>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <Card className="p-5 shadow-sm"><SectionTitle icon={Hammer}>Конструктив</SectionTitle><div className="space-y-4"><div className="grid grid-cols-1 gap-3">{['foundation:Фундамент:Монолитная плита,Свайный', 'walls:Стены:Монолитный ж/б,Кирпич,Блок', 'slabs:Перекрытия:Монолитные ж/б,Сборные плиты', 'roof:Крыша:Плоская рулонная,Скатная'].map(field => { const [key, label, opts] = field.split(':'); return <div key={key} className="space-y-1"><Label>{label}</Label><Select className="text-xs py-1.5" value={details[key]} onChange={(e)=>updateDetail(key, e.target.value)}>{opts.split(',').map(o=><option key={o}>{o}</option>)}</Select></div>; })}</div></div></Card>
                        <Card className="p-6 shadow-sm"><SectionTitle icon={Zap}>Инженерия</SectionTitle><div className="space-y-2 mt-4">{engineeringSystems.map(sys => { const isActive = details.engineering?.[sys.id]; const Icon = sys.icon; return (<button key={sys.id} onClick={() => updateDetail('engineering', {...details.engineering, [sys.id]: !isActive})} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isActive ? sys.color + ' shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}><div className="flex items-center gap-3"><Icon size={18} /><span className="text-xs font-bold uppercase">{sys.label}</span></div><div className={`w-4 h-4 rounded border flex items-center justify-center ${isActive ? 'bg-white border-transparent' : 'border-slate-300'}`}>{isActive && <div className="w-2 h-2 rounded-full bg-current"/>}</div></button>) })}</div></Card>
                    </div>
                </div>
            ) : (
                // --- СТАНДАРТНЫЙ ИНТЕРФЕЙС (ЖИЛЬЕ / НЕЖИЛЫЕ БЛОКИ) ---
                <>
                    <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max overflow-x-auto max-w-full mb-6 scrollbar-none">
                        {visibleBlocks.map((block) => (
                            <TabButton key={block.id} active={activeTabId === block.id} onClick={() => setActiveTabId(block.id)}>{block.tabLabel}</TabButton>
                        ))}
                        <TabButton active={activeTabId === 'photo'} onClick={() => setActiveTabId('photo')}><ImageIcon size={14}/> Фасад</TabButton>
                    </div>

                    {currentBlockId && activeTabId !== 'photo' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <Card className="p-5 shadow-sm">
                                    <SectionTitle icon={Hammer}>Конструктив</SectionTitle>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {['foundation:Фундамент:Монолитная плита,Свайный', 'walls:Стены:Монолитный ж/б,Кирпич,Блок', 'slabs:Перекрытия:Монолитные ж/б,Сборные плиты', 'roof:Крыша:Плоская рулонная,Скатная,Эксплуатируемая'].map(field => { const [key, label, opts] = field.split(':'); return <div key={key} className="space-y-1"><Label>{label}</Label><Select className="text-xs py-1.5" value={details[key]} onChange={(e)=>updateDetail(key, e.target.value)}>{opts.split(',').map(o=><option key={o}>{o}</option>)}</Select></div>; })}
                                    </div>
                                </Card>
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
                                                    return (<button key={res.id} disabled={isDisabled} onClick={() => toggleParentBlock(res.id)} className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : isDisabled ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}><div className="flex items-center gap-3">{isDisabled ? <Lock size={14}/> : <Building2 size={14}/>}<div><span className="text-[10px] font-bold block">{res.tabLabel}</span>{isDisabled && <span className="text-[9px] text-red-400 block">Занят: {occupiedBy}</span>}</div></div>{isSelected && <div className="w-2 h-2 rounded-full bg-white shrink-0"/>}</button>)
                                                })}
                                            </div>
                                        </div>
                                    </Card>
                                )}
                                <Card className="p-6 shadow-sm">
                                    <SectionTitle icon={Maximize}>Параметры этажности</SectionTitle>
                                    <div className="grid grid-cols-2 gap-8 mb-6">
                                        <div className="space-y-1">
                                            <Label>С этажа {errors.floorsFrom && <span className="text-red-500 text-[9px] ml-1">{errors.floorsFrom}</span>}</Label>
                                            <Input type="number" min="1" value={isFloorFromDisabled ? 1 : details.floorsFrom} onChange={(e) => { const val = e.target.value; if (val === '') { updateDetail('floorsFrom', ''); return; } let num = parseInt(val); if (num < 1) num = 1; updateDetail('floorsFrom', num); }} disabled={isFloorFromDisabled} className={`${isFloorFromDisabled ? "bg-slate-100 text-slate-500 cursor-not-allowed font-bold" : ""} ${ErrorBorder('floorsFrom')}`}/>
                                            {isFloorFromDisabled && <span className="text-[10px] text-slate-400">Начинается всегда с 1-го этажа</span>}
                                        </div>
                                        <div className="space-y-1">
                                            <Label>По этаж (макс. 50)</Label>
                                            <Input type="number" min="1" max="50" value={details.floorsTo} onChange={(e) => { const val = e.target.value; if (val === '') { updateDetail('floorsTo', ''); return; } let num = parseInt(val); if (num > 50) num = 50; updateDetail('floorsTo', num); }} className={ErrorBorder('floorsTo')}/>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-4 mt-4 mb-6">
                                        {[{k: 'hasBasementFloor', l: 'Цокольный этаж', disabled: isResBasementLocked}, {k: 'hasAttic', l: 'Мансарда', disabled: isStylobate}, {k: 'hasLoft', l: 'Чердак', disabled: isStylobate}, {k: 'hasExploitableRoof', l: 'Эксплуатируемая крыша', disabled: isStylobate}].map(({k, l, disabled}) => (<label key={k} className={`flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-300'}`}><input type="checkbox" disabled={disabled} checked={details[k] || false} onChange={(e)=>updateDetail(k,e.target.checked)} className="rounded text-blue-600 w-4 h-4"/><span className="text-xs font-bold text-slate-600">{l}</span>{disabled && k === 'hasBasementFloor' && <span className="text-[8px] text-red-400 ml-auto">Занят стилобатом</span>}</label>))}
                                    </div>
                                    <div className="mt-4 p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                                        <div className="flex items-center gap-2 mb-3"><div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Settings2 size={16}/></div><div><Label className="text-amber-900">Вставка тех. этажей</Label><p className="text-[10px] text-amber-600/80 leading-tight">Выберите этаж, <b>НАД</b> которым нужно добавить тех.этаж</p></div></div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {
                                            floorRange.map((f, idx) => { 
                                                // @ts-ignore
                                                const isTech = details.technicalFloors?.includes(f); 
                                                const isGap = (idx > 0) && (idx % 10 === 0); 
                                                const isLockedByStylobate = currentBlock.type === 'Ж' && f <= stylobateHeightUnderCurrentBlock; 
                                                return (<React.Fragment key={f}>{isGap && <div className="w-3"></div>}<button disabled={isLockedByStylobate} onClick={() => toggleFloorAttribute('technicalFloors', f)} className={`w-8 h-8 rounded-md text-xs font-bold shadow-sm transition-all border flex items-center justify-center gap-1 relative ${isLockedByStylobate ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : isTech ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50'}`} title={isLockedByStylobate ? 'Этаж занят стилобатом' : ''}>{f}{isLockedByStylobate ? <Lock size={8} className="absolute top-0.5 right-0.5 opacity-50"/> : (isTech ? <ArrowUpFromLine size={10}/> : <Plus size={10} className="opacity-50"/>)}</button></React.Fragment>) 
                                            })
                                            }
                                        </div>
                                    </div>
                                    {building.hasNonResPart && currentBlock.type === 'Ж' && (
                                        <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center gap-2 mb-4"><div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Store size={16}/></div><div><Label className="text-blue-900">Нежилые объекты (Коммерция)</Label><p className="text-[10px] text-blue-500/80 leading-tight">Отметьте этажи с нежилыми помещениями.</p></div></div>
                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                {/* Кнопки Подвалов */}
                                                {blockBasements.map((b, idx) => {
                                                    const val = `basement_${b.id}`; 
                                                    // @ts-ignore
                                                    const isActive = details.commercialFloors?.includes(val);
                                                    return (
                                                         <button 
                                                            key={b.id} 
                                                            onClick={() => toggleFloorAttribute('commercialFloors', val)} 
                                                            className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${isActive ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'}`}
                                                         >
                                                            P-{idx+1}
                                                         </button>
                                                    )
                                                })}

                                                {/* Кнопка Цоколь */}
                                                {details.hasBasementFloor && (
                                                    // @ts-ignore
                                                    <button onClick={() => toggleFloorAttribute('commercialFloors', 'tsokol')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('tsokol') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'}`}>Цоколь</button>
                                                )}

                                                {floorRange.map((f, idx) => { 
                                                    // @ts-ignore
                                                    const isComm = details.commercialFloors?.includes(f); 
                                                    // @ts-ignore
                                                    const isCommTech = details.commercialFloors?.includes(`${f}-Т`); 
                                                    const isLockedByStylobate = f <= stylobateHeightUnderCurrentBlock; 
                                                    return (<React.Fragment key={f}>{idx > 0 && idx % 10 === 0 && <div className="w-3"></div>}<button disabled={isLockedByStylobate} onClick={() => toggleFloorAttribute('commercialFloors', f)} className={`w-8 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${isLockedByStylobate ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed' : isComm ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'}`} title={isLockedByStylobate ? 'Этаж занят стилобатом (нежилым блоком)' : ''}>{f}{isLockedByStylobate && <Lock size={8} className="absolute top-0.5 right-0.5 opacity-50"/>}</button>{
                                                        // @ts-ignore
                                                        details.technicalFloors?.includes(f) && (<button onClick={() => toggleFloorAttribute('commercialFloors', `${f}-Т`)} className={`px-1.5 h-8 rounded-md text-[10px] font-bold shadow-sm transition-all border flex items-center justify-center relative ${isCommTech ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-500 hover:bg-indigo-100'}`} title={`Отметить тех.этаж ${f}-Т как нежилой`}>{f}-Т</button>)}</React.Fragment>) 
                                                    })
                                                }

                                                {/* Кнопки спецэтажей */}
                                                {details.hasAttic && (
                                                    // @ts-ignore
                                                    <button onClick={() => toggleFloorAttribute('commercialFloors', 'attic')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('attic') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'}`}>Мансарда</button>
                                                )}
                                                {details.hasLoft && (
                                                    // @ts-ignore
                                                    <button onClick={() => toggleFloorAttribute('commercialFloors', 'loft')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('loft') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'}`}>Чердак</button>
                                                )}
                                                {details.hasExploitableRoof && (
                                                    // @ts-ignore
                                                    <button onClick={() => toggleFloorAttribute('commercialFloors', 'roof')} className={`px-2 h-8 rounded-md text-xs font-bold shadow-sm transition-all border relative ${details.commercialFloors?.includes('roof') ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'}`}>Кровля</button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                                <Card className="p-6 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4"><SectionTitle icon={ArrowDownToLine} className="mb-0">Подвал</SectionTitle><button onClick={createBlockBasement} disabled={!canAddBasement} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${ canAddBasement ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'}`}>{canAddBasement ? '+ Добавить подвал' : 'Макс. 3 уровня'}</button></div>
                                    {blockBasements.length === 0 ? (<div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">Подвальные помещения отсутствуют</div>) : (<div className="space-y-3">{blockBasements.map((base, idx) => (<div key={base.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 relative group text-white shadow-inner"><button onClick={() => removeBasement(base.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition-all"><X size={14}/></button><div className="flex gap-4 items-center"><div className="w-10 h-10 flex items-center justify-center bg-slate-700 border border-slate-600 rounded-lg font-bold text-slate-300 shadow-sm">P-{idx+1}</div><div className="flex flex-col gap-0.5"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Уровень {idx+1}</span><div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-300">Глубина:</span><input type="number" value={-base.depth} onChange={(e) => { let val = parseInt(e.target.value); if (isNaN(val)) val = -1; if (val > 0) val = -val; if (val > -1) val = -1; if (val < -4) val = -4; updateBasement(base.id, 'depth', Math.abs(val)); }} className="w-14 text-center bg-slate-900 border border-slate-600 rounded text-sm font-bold text-white focus:border-blue-500 outline-none py-0.5"/></div></div></div></div>))}</div>)}
                                </Card>
                            </div>
                            <div className="space-y-6">
                                <Card className="p-6 shadow-sm"><SectionTitle icon={Settings2}>Общие</SectionTitle><div className="space-y-4"><div className="space-y-1"><Label>{currentBlock?.type === 'Ж' ? 'Подъездов' : 'Входов'} (макс. 30)</Label><Input type="number" min="1" max="30" value={details.entrances || 1} onChange={(e) => { let val = parseInt(e.target.value); if (isNaN(val)) val = 1; if (val > 30) val = 30; if (val < 1) val = 1; updateDetail('entrances', val); }} className={ErrorBorder('entrances')}/></div><div className="space-y-1 relative"><Label>Лифтов (на блок)</Label><Input type="number" min="0" value={details.elevators || 0} onChange={(e)=> { let val = parseInt(e.target.value); if (val < 0) val = 0; updateDetail('elevators', val) }} className={hasElevatorIssue ? "border-red-500 focus:border-red-500 bg-red-50" : ""}/>{hasElevatorIssue && <div className="flex items-center gap-1 mt-1 text-[10px] text-red-500 font-bold animate-in fade-in"><AlertCircle size={10} /><span>Лифт обязателен &gt; 5 этажей</span></div>}</div></div></Card>
                                <Card className="p-6 shadow-sm"><SectionTitle icon={Zap}>Инженерия</SectionTitle><div className="grid grid-cols-2 gap-2">{engineeringSystems.map(sys => { const isActive = details.engineering?.[sys.id]; const Icon = sys.icon; return (<button key={sys.id} onClick={()=>updateDetail('engineering', {...details.engineering, [sys.id]: !isActive})} className={`p-3 rounded-xl border flex items-center gap-3 transition-all duration-200 ${isActive ? sys.color + ' shadow-sm' : 'bg-white border-slate-100 text-slate-400 opacity-60 hover:opacity-100'}`}><Icon size={16} strokeWidth={isActive ? 2.5 : 2} /><span className="text-[10px] font-bold uppercase">{sys.label}</span></button>)})}</div></Card>
                                
                                <div className="flex flex-col gap-3">
                                    {(isResidentialBlock && !isCommercialValid) && (<div className="text-[10px] text-red-500 bg-red-50 p-2 rounded text-center border border-red-100">Укажите коммерческие этажи хотя бы в одном жилом блоке</div>)}
                                    <Button onClick={autoFillConfig} variant="secondary" className="bg-purple-50 text-purple-600 border-purple-100"><Wand2 size={14}/> Авто-заполнение</Button>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTabId === 'photo' && !isParking && !isInfrastructure && (<Card className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] border-2 border-dashed border-slate-200 shadow-none">
                        {/** @type {any} */ (buildingDetails[`${building.id}_photo`]) ? (
                            <div className="relative group max-w-lg">
                                <img src={/** @type {any} */ (buildingDetails[`${building.id}_photo`])} className="rounded-2xl shadow-xl ring-4 ring-white" alt="Facade"/>
                                <button onClick={()=>setBuildingDetails(p=>({...p, [`${building.id}_photo`]: ''}))} className="absolute top-4 right-4 bg-white text-red-500 p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"><Trash2 size={20}/></button>
                            </div>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-2"><ImageIcon size={40}/></div>
                                <div><h3 className="text-lg font-bold text-slate-700">Изображение фасада</h3><p className="text-slate-400 text-sm">Вставьте прямую ссылку на изображение</p></div>
                                <div className="flex gap-2 w-full max-w-md mt-4"><Input type="text" placeholder="https://example.com/image.jpg" value={photoUrlInput} onChange={e=>setPhotoUrlInput(e.target.value)} className="shadow-sm" /><Button onClick={()=>{if(photoUrlInput) setBuildingDetails(p=>({...p, [`${building.id}_photo`]: photoUrlInput}))}} className="shadow-lg shadow-blue-200">Загрузить</Button></div>
                            </>
                        )}
                    </Card>)}
                </>
            )}

            {/* [NEW] НОВАЯ ПАНЕЛЬ СОХРАНЕНИЯ ВНИЗУ */}
            <SaveFloatingBar onSave={handleSave} disabled={hasCriticalErrors} />
        </div>
    );
}