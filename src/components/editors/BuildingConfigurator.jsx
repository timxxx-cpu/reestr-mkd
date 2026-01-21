import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wand2, Save, ImageIcon, Hammer, Maximize, 
  ArrowDownToLine, X, Zap, Settings2, Trash2, Droplets, 
  Thermometer, Flame, Wind, ShieldCheck, Wifi, Store, Layers,
  Fan, Plug
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, Select, Button, TabButton } from '../ui/UIKit';

// Утилита для получения списка блоков
function getBlocksList(building) {
    if (!building) return [];
    const list = [];
    if (building.category && building.category.includes('residential')) {
        for(let i=0; i<(building.resBlocks || 0); i++) {
            list.push({ id: `res_${i}`, type: 'Ж', index: i, fullId: `${building.id}_res_${i}` });
        }
    }
    if (building.category === 'parking_separate') {
         list.push({ id: 'main', type: 'Паркинг', index: 0, fullId: `${building.id}_main` });
    } else if (building.category === 'infrastructure') {
         list.push({ id: 'main', type: 'Инфра', index: 0, fullId: `${building.id}_main` });
    } else {
         for(let i=0; i<(building.nonResBlocks || 0); i++) {
             list.push({ id: `non_${i}`, type: 'Н', index: i, fullId: `${building.id}_non_${i}` });
         }
    }
    if (list.length === 0) list.push({ id: 'main', type: 'Основной', index: 0, fullId: `${building.id}_main` });
    return list;
}

export default function BuildingConfigurator({ buildingId, mode = 'all', onBack }) {
    const { composition, buildingDetails, setBuildingDetails, saveData } = useProject();
    
    const building = useMemo(() => composition.find(c => c.id === buildingId), [composition, buildingId]);
    const [activeTabId, setActiveTabId] = useState('photo'); 
    const [photoUrlInput, setPhotoUrlInput] = useState('');

    const blocksList = useMemo(() => getBlocksList(building), [building]);
  
    // Фильтр блоков
    const visibleBlocks = useMemo(() => {
        if (!building) return [];
        if (mode === 'res') return blocksList.filter(b => b.type === 'Ж');
        if (mode === 'nonres') return blocksList.filter(b => b.type !== 'Ж');
        return blocksList;
    }, [blocksList, mode, building]);

    // Авто-переключение на первый доступный блок
    useEffect(() => {
        if (visibleBlocks.length > 0 && activeTabId === 'photo') {
            setActiveTabId(visibleBlocks[0].id);
        } else if (visibleBlocks.length > 0 && !visibleBlocks.find(b => b.id === activeTabId)) {
            setActiveTabId(visibleBlocks[0].id);
        }
    }, [visibleBlocks.length, mode]);

    if (!building) return <div className="p-8 text-center">Объект не найден</div>;

    const currentBlock = blocksList.find(b => b.id === activeTabId);
    const currentBlockId = currentBlock?.id;
    const isResidentialBlock = currentBlock?.type === 'Ж';
    const detailsKey = currentBlockId ? `${building.id}_${currentBlockId}` : null;
    const featuresKey = `${building.id}_features`;

    // Данные
    const features = buildingDetails[featuresKey] || { basements: [], exploitableRoofs: [] };
    const details = buildingDetails[detailsKey] || { 
        foundation: 'Монолитная плита', walls: 'Кирпич', slabs: 'Монолитные ж/б', roof: 'Плоская рулонная', 
        floorsFrom: 1, floorsTo: 1, entrances: 1, inputs: 1, vehicleEntries: 1, elevators: 0, 
        commercialFloors: [], 
        hasBasementFloor: false, hasAttic: false, hasLoft: false, 
        hasTechnicalFloor: false, technicalFloors: [], 
        hasExploitableRoof: false, 
        placementType: 'attached', parentBlocks: [],
        engineering: { hvs: true, gvs: true, heating: true, electricity: true, gas: false, sewerage: true, ventilation: true, firefighting: true, lowcurrent: true } 
    };

    const residentialBlocks = blocksList.filter(b => b.type === 'Ж');

    const updateDetail = (key, val) => setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
    const updateFeatures = (updates) => setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, ...updates } }));
    
    // --- ПОДВАЛЫ ---
    const updateBasement = (id, field, val) => {
        const updatedBasements = (features.basements || []).map(b => b.id === id ? { ...b, [field]: val } : b);
        updateFeatures({ basements: updatedBasements });
    };

    // Проверка лимита подвалов (макс 3)
    const blockBasements = (features.basements || []).filter(b => b.blocks?.includes(currentBlock?.id));
    const canAddBasement = blockBasements.length < 3;

    const createBlockBasement = () => {
        if (!canAddBasement) return; // Защита от клика
        const isUndergroundParking = building.category === 'parking_separate' && building.parkingType === 'underground';
        const newB = { id: Date.now(), depth: 1, hasParking: isUndergroundParking, parkingLevels: isUndergroundParking ? {1: true} : {}, blocks: [currentBlock.id] }; 
        updateFeatures({ basements: [...(features.basements || []), newB] }); 
    };

    const removeBasement = (id) => updateFeatures({ basements: (features.basements || []).filter(b => b.id !== id) });
    
    // --- ЭТАЖИ ---
    const floorRange = useMemo(() => {
        const from = details.floorsFrom || 1;
        const to = details.floorsTo || 1;
        const safeTo = Math.min(to, 50); 
        return Array.from({length: safeTo - from + 1}, (_, i) => from + i);
    }, [details.floorsFrom, details.floorsTo]);

    const toggleFloorAttribute = (targetList, floor) => {
        const otherList = targetList === 'commercialFloors' ? 'technicalFloors' : 'commercialFloors';
        const currentTarget = details[targetList] || [];
        const currentOther = details[otherList] || [];
        
        let newOther = currentOther;
        if (!currentTarget.includes(floor) && currentOther.includes(floor)) {
            newOther = currentOther.filter(f => f !== floor);
        }
        
        const newTarget = currentTarget.includes(floor) ? currentTarget.filter(f => f !== floor) : [...currentTarget, floor];
        
        setBuildingDetails(prev => ({
            ...prev,
            [detailsKey]: { ...details, [targetList]: newTarget, [otherList]: newOther }
        }));
    };

    const autoFillConfig = () => {
        const updates = {};
        const baseKey = `${building.id}_features`; 
        const newBasements = blocksList.map((b, i) => ({ id: Date.now() + i, depth: 1, hasParking: true, parkingLevels: {1: true}, blocks: [b.id] }));
        setBuildingDetails(prev => ({ ...prev, [baseKey]: { basements: newBasements, exploitableRoofs: [] } }));
        blocksList.forEach((b) => { 
             const k = `${building.id}_${b.id}`; 
             updates[k] = { 
                 foundation: 'Монолитная плита', walls: 'Кирпич', slabs: 'Монолитные ж/б', roof: 'Плоская рулонная', 
                 floorsFrom: 1, floorsTo: 9, entrances: 2, inputs: 1, vehicleEntries: 1, elevators: 1, 
                 commercialFloors: b.type === 'Ж' ? [1] : [], hasBasementFloor: true, 
                 engineering: { hvs: true, gvs: true, heating: true, electricity: true, sewerage: true, ventilation: true, firefighting: true, lowcurrent: true } 
             }; 
        });
        setBuildingDetails(prev => ({ ...prev, ...updates }));
    };

    // --- СИСТЕМЫ ИНЖЕНЕРИИ (СЕМАНТИЧЕСКИЕ ЦВЕТА) ---
    const engineeringSystems = [
        { id: 'hvs', label: 'ХВС', icon: Droplets, color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
        { id: 'gvs', label: 'ГВС', icon: Droplets, color: 'text-cyan-600 bg-cyan-50 border-cyan-200 hover:bg-cyan-100' },
        { id: 'sewerage', label: 'Канализ.', icon: ArrowDownToLine, color: 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200' },
        { id: 'heating', label: 'Отопл.', icon: Thermometer, color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
        { id: 'gas', label: 'Газ', icon: Flame, color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
        { id: 'electricity', label: 'Электро', icon: Zap, color: 'text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100' },
        { id: 'lowcurrent', label: 'Слаботоч.', icon: Wifi, color: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
        { id: 'ventilation', label: 'Вент.', icon: Fan, color: 'text-teal-600 bg-teal-50 border-teal-200 hover:bg-teal-100' },
        { id: 'firefighting', label: 'Пож.', icon: ShieldCheck, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
    ];

    const specialCommercialLevels = [
        { id: 'basement', label: 'Цоколь / Подвал', condition: details.hasBasementFloor },
        { id: 'attic', label: 'Мансарда', condition: details.hasAttic },
        { id: 'tech', label: 'Технический этаж', condition: details.hasTechnicalFloor },
        { id: 'roof', label: 'Крыша', condition: details.hasExploitableRoof },
    ];

    return (
        <div className="animate-in slide-in-from-bottom duration-500 space-y-6 pb-20 max-w-7xl mx-auto">
            {/* --- HEADER --- */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><ArrowLeft size={24}/></button>
                    <div><h2 className="text-2xl font-bold text-slate-800 leading-tight">{building.label}</h2><p className="text-slate-500 text-xs font-semibold uppercase tracking-wider opacity-70">Конфигурация {mode === 'nonres' ? '(Нежилые)' : mode === 'res' ? '(Жилые)' : ''}</p></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFillConfig} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors"><Wand2 size={14}/> Авто-конфиг</button>
                    <Button onClick={() => { saveData(); onBack(); }} className="shadow-lg shadow-blue-200"><Save size={16}/> Готово</Button>
                </div>
            </div>

            {/* --- TABS --- */}
            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max overflow-x-auto max-w-full mb-6">
                {visibleBlocks.map((block) => (<TabButton key={block.id} active={activeTabId === block.id} onClick={() => setActiveTabId(block.id)}>Блок {block.index + 1} ({block.type})</TabButton>))}
                <TabButton active={activeTabId === 'photo'} onClick={() => setActiveTabId('photo')}><ImageIcon size={14}/> Фасад</TabButton>
            </div>
            
            {currentBlockId && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* --- ЛЕВАЯ КОЛОНКА (Конструктив, Этажи, Подвал) --- */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* --- 1. КОНСТРУКТИВ (Сжатый) --- */}
                        <Card className="p-5 shadow-sm">
                            <SectionTitle icon={Hammer}>Конструктив</SectionTitle>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {['foundation:Фундамент:Монолитная плита,Свайный', 'walls:Стены:Монолитный ж/б,Кирпич,Блок', 'slabs:Перекрытия:Монолитные ж/б,Сборные плиты', 'roof:Крыша:Плоская,Скатная'].map(field => {
                                    const [key, label, opts] = field.split(':'); 
                                    return <div key={key} className="space-y-1"><Label>{label}</Label><Select className="text-xs py-1.5" value={details[key]} onChange={(e)=>updateDetail(key, e.target.value)}>{opts.split(',').map(o=><option key={o}>{o}</option>)}</Select></div>;
                                })}
                            </div>
                        </Card>

                        {/* --- 2. ЭТАЖНОСТЬ И ЗОНИРОВАНИЕ --- */}
                        <Card className="p-6 shadow-sm">
                            <SectionTitle icon={Maximize}>Параметры этажности</SectionTitle>
                            
                            {/* Поля ввода этажей */}
                            <div className="grid grid-cols-2 gap-8 mb-6">
                                <div className="space-y-1">
                                    <Label>С этажа</Label>
                                    <Input 
                                        type="number" 
                                        value={isResidentialBlock ? 1 : details.floorsFrom} 
                                        onChange={(e)=>updateDetail('floorsFrom', parseInt(e.target.value)||1)}
                                        disabled={isResidentialBlock}
                                        className={isResidentialBlock ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}
                                    />
                                    {isResidentialBlock && <span className="text-[10px] text-slate-400">Жилой блок всегда с 1-го этажа</span>}
                                </div>
                                <div className="space-y-1">
                                    <Label>По этаж (макс. 50)</Label>
                                    <Input 
                                        type="number" min="1" max="50"
                                        value={details.floorsTo} 
                                        onChange={(e) => {
                                            let val = parseInt(e.target.value) || 1;
                                            if (val > 50) val = 50; 
                                            updateDetail('floorsTo', val);
                                        }} 
                                    />
                                </div>
                            </div>
                            
                            {/* Чекбоксы атрибутов */}
                            <div className="flex flex-wrap gap-4 mt-4 mb-6">
                                {[
                                    {k: 'hasBasementFloor', l: 'Цокольный этаж'}, 
                                    {k: 'hasAttic', l: 'Мансарда'}, 
                                    {k: 'hasTechnicalFloor', l: 'Технический этаж'}, 
                                    {k: 'hasExploitableRoof', l: 'Эксплуатируемая крыша'}, 
                                ].map(({k, l}) => (
                                    <label key={k} className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 hover:border-blue-300 transition-colors">
                                        <input type="checkbox" checked={details[k] || false} onChange={(e)=>updateDetail(k,e.target.checked)} className="rounded text-blue-600 w-4 h-4"/>
                                        <span className="text-xs font-bold text-slate-600">{l}</span>
                                    </label>
                                ))}
                            </div>

                            {/* --- ЗОНА: НЕЖИЛЫЕ ОБЪЕКТЫ (СИНЯЯ) --- */}
                            {building.hasNonResPart && (
                                <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                            <Store size={16}/>
                                        </div>
                                        <div>
                                            <Label className="text-blue-900">Нежилые объекты</Label>
                                            <p className="text-[10px] text-blue-500/80 leading-tight">Выберите уровни размещения встроенных помещений.</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {floorRange.map((f, idx) => {
                                            const isComm = details.commercialFloors?.includes(f);
                                            const isGap = (idx > 0) && (idx % 10 === 0);
                                            
                                            return (
                                                <React.Fragment key={f}>
                                                    {isGap && <div className="w-3"></div>}
                                                    <button onClick={() => toggleFloorAttribute('commercialFloors', f)} className={`w-8 h-8 rounded-md text-xs font-bold shadow-sm transition-all border ${isComm ? 'bg-blue-600 border-blue-600 text-white transform scale-105' : 'bg-white border-blue-200 text-blue-400 hover:bg-blue-100'}`}>
                                                        {f}
                                                    </button>
                                                </React.Fragment>
                                            )
                                        })}
                                    </div>

                                    {specialCommercialLevels.some(l => l.condition) && (
                                        <div className="pt-3 border-t border-blue-200/50">
                                            <Label className="text-[10px] mb-2 text-blue-400 font-bold uppercase block">Специальные уровни:</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {specialCommercialLevels.map(lvl => {
                                                    if (!lvl.condition) return null;
                                                    const isSelected = details.commercialFloors?.includes(lvl.id);
                                                    return (
                                                        <button key={lvl.id} onClick={() => toggleFloorAttribute('commercialFloors', lvl.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-blue-200 text-blue-500 hover:bg-blue-50'}`}>
                                                            <Layers size={12} /> {lvl.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- ЗОНА: ТЕХНИЧЕСКИЕ ЭТАЖИ (ОРАНЖЕВАЯ) --- */}
                            {details.hasTechnicalFloor && (
                                <div className="mt-4 p-4 bg-amber-50/50 border border-amber-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Settings2 size={16}/></div>
                                        <Label className="text-amber-900">Технические этажи</Label>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {floorRange.map((f, idx) => {
                                            const isTech = details.technicalFloors?.includes(f);
                                            const isGap = (idx > 0) && (idx % 10 === 0);
                                            return (
                                                <React.Fragment key={f}>
                                                    {isGap && <div className="w-3"></div>}
                                                    <button onClick={() => toggleFloorAttribute('technicalFloors', f)} className={`w-8 h-8 rounded-md text-xs font-bold shadow-sm transition-all border ${isTech ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-amber-200 text-amber-400 hover:bg-amber-100'}`}>
                                                        {f}
                                                    </button>
                                                </React.Fragment>
                                            )
                                        })}
                                    </div>
                                    <p className="text-[10px] text-amber-500/80 mt-2">Технические этажи исключаются из жилого фонда.</p>
                                </div>
                            )}
                        </Card>

                        {/* --- 3. ПОДВАЛ (ВИЗУАЛЬНОЕ УГЛУБЛЕНИЕ) --- */}
                        <Card className="p-6 shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                                <SectionTitle icon={ArrowDownToLine} className="mb-0">Подвал</SectionTitle>
                                <button 
                                    onClick={createBlockBasement} 
                                    disabled={!canAddBasement}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${
                                        canAddBasement 
                                        ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' 
                                        : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed opacity-60'
                                    }`}
                                >
                                    {canAddBasement ? '+ Добавить подвал' : 'Макс. 3 уровня'}
                                </button>
                            </div>
                            
                            {blockBasements.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    Подвальные помещения отсутствуют
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {blockBasements.map((base, idx) => (
                                        <div key={base.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 relative group text-white shadow-inner">
                                            <button onClick={() => removeBasement(base.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-slate-700 p-1 rounded transition-all">
                                                <X size={14}/>
                                            </button>
                                            <div className="flex gap-4 items-center">
                                                <div className="w-10 h-10 flex items-center justify-center bg-slate-700 border border-slate-600 rounded-lg font-bold text-slate-300 shadow-sm">
                                                    P-{idx+1}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Уровень {idx+1}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-slate-300">Глубина этажей вниз:</span>
                                                        <input 
                                                            type="number" 
                                                            // Визуально показываем как отрицательное число
                                                            value={-base.depth}
                                                            onChange={(e) => {
                                                                let val = parseInt(e.target.value);
                                                                if (isNaN(val)) val = -1;
                                                                if (val > 0) val = -val;
                                                                if (val > -1) val = -1;
                                                                if (val < -4) val = -4; // Лимит -4
                                                                updateBasement(base.id, 'depth', Math.abs(val));
                                                            }} 
                                                            className="w-14 text-center bg-slate-900 border border-slate-600 rounded text-sm font-bold text-white focus:border-blue-500 outline-none py-0.5"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* --- ПРАВАЯ КОЛОНКА (Инженерия, Общие) --- */}
                    <div className="space-y-6">
                        <Card className="p-6 shadow-sm">
                            <SectionTitle icon={Zap}>Инженерия</SectionTitle>
                            <div className="grid grid-cols-2 gap-2">
                                {engineeringSystems.map(sys => {
                                    const Icon = sys.icon; 
                                    const isActive = details.engineering?.[sys.id]; 
                                    return (
                                        <button 
                                            key={sys.id} 
                                            onClick={()=>updateDetail('engineering', {...details.engineering, [sys.id]: !isActive})} 
                                            className={`p-3 rounded-xl border flex items-center gap-3 transition-all duration-200 ${isActive ? sys.color + ' shadow-sm' : 'bg-white border-slate-100 text-slate-400 opacity-60 hover:opacity-100'}`}
                                        >
                                            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                            <span className="text-[10px] font-bold uppercase">{sys.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </Card>
                        
                        <Card className="p-6 shadow-sm">
                            <SectionTitle icon={Settings2}>Общие</SectionTitle>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label>Подъездов / Входов (макс. 30)</Label>
                                    <Input 
                                        type="number" 
                                        min="1" max="30"
                                        value={details.entrances || 1} 
                                        onChange={(e) => {
                                            let val = parseInt(e.target.value) || 1;
                                            if (val > 30) val = 30; // Лимит 30
                                            if (val < 1) val = 1;
                                            updateDetail('entrances', val);
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Лифтов (на блок)</Label>
                                    <Input type="number" value={details.elevators || 0} onChange={(e)=>updateDetail('elevators', parseInt(e.target.value)||0)}/>
                                </div>
                            </div>
                        </Card>

                        {/* СПЕЦИФИКА ДЛЯ НЕЖИЛЫХ БЛОКОВ */}
                        {currentBlock.type === 'Н' && (
                            <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4 shadow-xl">
                                <h4 className="text-[10px] font-bold uppercase opacity-60 flex items-center gap-2"><Settings2 size={12}/> Специфика блока</h4>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Тип размещения</label>
                                    <select 
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs font-bold text-white outline-none focus:border-blue-500" 
                                        value={details.placementType || 'attached'} 
                                        onChange={e => updateDetail('placementType', e.target.value)}
                                    >
                                        <option value="attached">Отдельно-пристроенный</option>
                                        <option value="built_in">Встроенный (стилобат)</option>
                                    </select>
                                </div>

                                {details.placementType === 'built_in' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 pt-2 border-t border-slate-800">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Находится под блоками:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {residentialBlocks.length > 0 ? residentialBlocks.map(resBlock => (
                                                <label key={resBlock.id} className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg border transition-all ${ (details.parentBlocks || []).includes(resBlock.id) ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-400' }`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={(details.parentBlocks || []).includes(resBlock.id)} 
                                                        onChange={() => { 
                                                            const current = details.parentBlocks || []; 
                                                            const updated = current.includes(resBlock.id) ? current.filter(id => id !== resBlock.id) : [...current, resBlock.id]; 
                                                            updateDetail('parentBlocks', updated); 
                                                        }} 
                                                        className="hidden"
                                                    />
                                                    <span className="text-[10px] font-bold">Блок {resBlock.index + 1}</span>
                                                </label>
                                            )) : (
                                                <span className="text-[10px] text-slate-500 italic">Нет доступных жилых блоков</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* --- ФАСАД --- */}
            {activeTabId === 'photo' && (
                <Card className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] border-2 border-dashed border-slate-200 shadow-none">
                    {buildingDetails[`${building.id}_photo`] ? (
                        <div className="relative group max-w-lg">
                            <img src={buildingDetails[`${building.id}_photo`]} className="rounded-2xl shadow-xl ring-4 ring-white" alt="Facade"/>
                            <button onClick={()=>setBuildingDetails(p=>({...p, [`${building.id}_photo`]: ''}))} className="absolute top-4 right-4 bg-white text-red-500 p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110">
                                <Trash2 size={20}/>
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-2">
                                <ImageIcon size={40}/>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-700">Изображение фасада</h3>
                                <p className="text-slate-400 text-sm">Вставьте прямую ссылку на изображение</p>
                            </div>
                            <div className="flex gap-2 w-full max-w-md mt-4">
                                <Input type="text" placeholder="https://example.com/image.jpg" value={photoUrlInput} onChange={e=>setPhotoUrlInput(e.target.value)} className="shadow-sm" />
                                <Button onClick={()=>{if(photoUrlInput) setBuildingDetails(p=>({...p, [`${building.id}_photo`]: photoUrlInput}))}} className="shadow-lg shadow-blue-200">Загрузить</Button>
                            </div>
                        </>
                    )}
                </Card>
            )}
        </div>
    );
}