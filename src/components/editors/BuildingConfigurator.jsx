import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Wand2, Save, ImageIcon, Hammer, Maximize, 
  ArrowDownToLine, X, Zap, Settings2, Trash2, Droplets, 
  Thermometer, Flame, Wind, ShieldCheck, Wifi 
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
  
    // Фильтр блоков в зависимости от режима (Жилые/Нежилые)
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
    const detailsKey = currentBlockId ? `${building.id}_${currentBlockId}` : null;
    const featuresKey = `${building.id}_features`;

    // Значения по умолчанию
    const features = buildingDetails[featuresKey] || { basements: [], exploitableRoofs: [] };
    const details = buildingDetails[detailsKey] || { 
        foundation: 'Монолитная плита', walls: 'Кирпич', slabs: 'Монолитные ж/б', roof: 'Плоская рулонная', 
        floorsFrom: 1, floorsTo: 1, entrances: 1, inputs: 1, vehicleEntries: 1, elevators: 0, 
        hasBlockCommercial: false, commercialFloors: [], 
        hasBasementFloor: false, hasAttic: false, hasLoft: false, 
        hasTechnicalFloor: false, technicalFloors: [], 
        placementType: 'attached', parentBlocks: [], // Для нежилых
        engineering: { hvs: true, gvs: true, heating: true, electricity: true, gas: false, sewerage: true, ventilation: true, firefighting: true, lowcurrent: true } 
    };

    // Списки для связей (если это нежилой блок, ищем жилые блоки в этом же здании)
    const residentialBlocks = blocksList.filter(b => b.type === 'Ж');

    const updateDetail = (key, val) => setBuildingDetails(prev => ({ ...prev, [detailsKey]: { ...details, [key]: val } }));
    const updateFeatures = (updates) => setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, ...updates } }));
    
    // Управление подвалами
    const updateBasement = (id, field, val) => {
        const updatedBasements = (features.basements || []).map(b => b.id === id ? { ...b, [field]: val } : b);
        updateFeatures({ basements: updatedBasements });
    };

    const createBlockBasement = () => {
        const isUndergroundParking = building.category === 'parking_separate' && building.parkingType === 'underground';
        const newB = { id: Date.now(), depth: 1, hasParking: isUndergroundParking, parkingLevels: isUndergroundParking ? {1: true} : {}, blocks: [currentBlock.id] }; 
        updateFeatures({ basements: [...(features.basements || []), newB] }); 
    };

    const removeBasement = (id) => updateFeatures({ basements: (features.basements || []).filter(b => b.id !== id) });
    const blockBasements = (features.basements || []).filter(b => b.blocks?.includes(currentBlock?.id));
    
    // Генерация массива этажей для кнопок выбора
    const floorRange = useMemo(() => {
        const from = details.floorsFrom || 1;
        const to = details.floorsTo || 1;
        return Array.from({length: to - from + 1}, (_, i) => from + i);
    }, [details.floorsFrom, details.floorsTo]);

    // Функция переключения атрибута этажа (коммерческий/технический)
    const toggleFloorAttribute = (targetList, floor) => {
        const otherList = targetList === 'commercialFloors' ? 'technicalFloors' : 'commercialFloors';
        const currentTarget = details[targetList] || [];
        const currentOther = details[otherList] || [];
        
        let newOther = currentOther;
        // Если этаж был в другом списке, убираем его оттуда
        if (!currentTarget.includes(floor) && currentOther.includes(floor)) {
            newOther = currentOther.filter(f => f !== floor);
        }
        
        const newTarget = currentTarget.includes(floor) ? currentTarget.filter(f => f !== floor) : [...currentTarget, floor];
        
        setBuildingDetails(prev => ({
            ...prev,
            [detailsKey]: {
                ...details,
                [targetList]: newTarget,
                [otherList]: newOther
            }
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
                 hasBlockCommercial: b.type === 'Ж', commercialFloors: [1], hasBasementFloor: true, 
                 engineering: { hvs: true, gvs: true, heating: true, electricity: true, sewerage: true, ventilation: true, firefighting: true, lowcurrent: true } 
             }; 
        });
        setBuildingDetails(prev => ({ ...prev, ...updates }));
    };

    return (
        <div className="animate-in slide-in-from-bottom duration-500 space-y-6 pb-20 max-w-7xl mx-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><ArrowLeft size={24}/></button>
                    <div><h2 className="text-2xl font-bold text-slate-800 leading-tight">{building.label}</h2><p className="text-slate-500 text-xs font-semibold uppercase tracking-wider opacity-70">Конфигурация {mode === 'nonres' ? '(Нежилые)' : mode === 'res' ? '(Жилые)' : ''}</p></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFillConfig} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors"><Wand2 size={14}/> Авто-конфиг</button>
                    <Button onClick={() => { saveData(); onBack(); }}><Save size={14}/> Готово</Button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-xl w-max overflow-x-auto max-w-full">
                {visibleBlocks.map((block) => (<TabButton key={block.id} active={activeTabId === block.id} onClick={() => setActiveTabId(block.id)}>Блок {block.index + 1} ({block.type})</TabButton>))}
                <TabButton active={activeTabId === 'photo'} onClick={() => setActiveTabId('photo')}><ImageIcon size={14}/> Фасад</TabButton>
            </div>
            
            {currentBlockId && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="p-8">
                            <SectionTitle icon={Hammer}>Конструктив</SectionTitle>
                            <div className="grid grid-cols-2 gap-6">{['foundation:Фундамент:Монолитная плита,Свайный', 'walls:Стены:Монолитный ж/б,Кирпич,Блок', 'slabs:Перекрытия:Монолитные ж/б,Сборные плиты', 'roof:Крыша:Плоская,Скатная'].map(field => {const [key, label, opts] = field.split(':'); return <div key={key} className="space-y-1"><Label>{label}</Label><Select value={details[key]} onChange={(e)=>updateDetail(key, e.target.value)}>{opts.split(',').map(o=><option key={o}>{o}</option>)}</Select></div>;})}</div>
                        </Card>

                        <Card className="p-8">
                            <SectionTitle icon={Maximize}>Параметры этажности</SectionTitle>
                            <div className="grid grid-cols-2 gap-8 mb-6">
                                <div className="space-y-1"><Label>С этажа</Label><Input type="number" value={details.floorsFrom} onChange={(e)=>updateDetail('floorsFrom', parseInt(e.target.value)||1)} /></div>
                                <div className="space-y-1"><Label>По этаж</Label><Input type="number" value={details.floorsTo} onChange={(e)=>updateDetail('floorsTo', parseInt(e.target.value)||1)} /></div>
                            </div>
                            
                            {/* Чекбоксы атрибутов */}
                            <div className="flex flex-wrap gap-4 mt-4 mb-6">
                                {[{k: 'hasBasementFloor', l: 'Цокольный этаж'}, {k: 'hasAttic', l: 'Мансарда'}, {k: 'hasTechnicalFloor', l: 'Технический этаж'}, {k: 'hasBlockCommercial', l: 'Коммерция'}].map(({k, l}) => (
                                    <label key={k} className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 hover:border-blue-300">
                                        <input type="checkbox" checked={details[k] || false} onChange={(e)=>updateDetail(k,e.target.checked)} className="rounded text-blue-600"/>
                                        <span className="text-xs font-bold text-slate-600">{l}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Выбор конкретных этажей для Коммерции */}
                            {details.hasBlockCommercial && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <Label>Коммерческие этажи</Label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {floorRange.map(f => {
                                            const isComm = details.commercialFloors?.includes(f);
                                            return (
                                                <button key={f} onClick={() => toggleFloorAttribute('commercialFloors', f)} className={`w-8 h-8 rounded-lg text-xs font-bold shadow-sm transition-all ${isComm ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                                    {f}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2">Нажмите на номер этажа, чтобы отметить его как коммерческий.</p>
                                </div>
                            )}

                            {/* Выбор конкретных этажей для Технических */}
                            {details.hasTechnicalFloor && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <Label>Технические этажи</Label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {floorRange.map(f => {
                                            const isTech = details.technicalFloors?.includes(f);
                                            return (
                                                <button key={f} onClick={() => toggleFloorAttribute('technicalFloors', f)} className={`w-8 h-8 rounded-lg text-xs font-bold shadow-sm transition-all ${isTech ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                                    {f}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2">Технические этажи исключаются из жилого фонда.</p>
                                </div>
                            )}
                        </Card>

                        <Card className="p-8">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4"><SectionTitle icon={ArrowDownToLine} className="mb-0">Подземная часть</SectionTitle><button onClick={createBlockBasement} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50">+ Добавить уровень</button></div>
                            <div className="space-y-4">{blockBasements.map((base, idx) => (<div key={base.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group"><button onClick={() => removeBasement(base.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-white p-1 rounded transition-opacity"><X size={14}/></button><div className="flex gap-4 items-center"><div className="w-8 h-8 flex items-center justify-center bg-white border rounded-lg font-bold text-slate-500">P-{idx+1}</div><div className="flex items-center gap-2 text-xs"><span className="font-bold text-slate-400">Глубина (этажей):</span><input type="number" min="1" value={base.depth} onChange={(e)=>updateBasement(base.id,'depth', parseInt(e.target.value)||1)} className="w-12 text-center border rounded font-bold p-1"/></div></div></div>))}</div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="p-8">
                            <SectionTitle icon={Zap}>Инженерия</SectionTitle>
                            <div className="grid grid-cols-2 gap-2">{[ { id: 'hvs', label: 'ХВС', icon: Droplets }, { id: 'gvs', label: 'ГВС', icon: Droplets }, { id: 'heating', label: 'Отопл.', icon: Thermometer }, { id: 'electricity', label: 'Электро', icon: Zap }, { id: 'gas', label: 'Газ', icon: Flame }, { id: 'sewerage', label: 'Канализ.', icon: ArrowDownToLine }, { id: 'ventilation', label: 'Вент.', icon: Wind }, { id: 'firefighting', label: 'Пож.', icon: ShieldCheck }, { id: 'lowcurrent', label: 'Слаботоч.', icon: Wifi } ].map(sys => {const Icon = sys.icon; const isActive = details.engineering?.[sys.id]; return (<button key={sys.id} onClick={()=>updateDetail('engineering', {...details.engineering, [sys.id]: !isActive})} className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${isActive ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-400'}`}><Icon size={16}/><span className="text-[10px] font-bold uppercase">{sys.label}</span></button>)})}</div>
                        </Card>
                        
                        <Card className="p-8">
                            <SectionTitle icon={Settings2}>Общие</SectionTitle>
                            <div className="space-y-4"><div className="space-y-1"><Label>Подъездов / Входов</Label><Input type="number" value={details.entrances || 1} onChange={(e)=>updateDetail('entrances', parseInt(e.target.value)||1)}/></div><div className="space-y-1"><Label>Лифтов (на блок)</Label><Input type="number" value={details.elevators || 0} onChange={(e)=>updateDetail('elevators', parseInt(e.target.value)||0)}/></div></div>
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
            
            {activeTabId === 'photo' && (<Card className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">{buildingDetails[`${building.id}_photo`] ? (<div className="relative group max-w-lg"><img src={buildingDetails[`${building.id}_photo`]} className="rounded-2xl shadow-lg" alt="Facade"/><button onClick={()=>setBuildingDetails(p=>({...p, [`${building.id}_photo`]: ''}))} className="absolute top-2 right-2 bg-white text-red-500 p-2 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-all"><Trash2/></button></div>) : (<><ImageIcon size={48} className="text-slate-300"/><h3 className="text-lg font-bold text-slate-600">Нет изображения</h3><div className="flex gap-2 w-full max-w-md"><Input type="text" placeholder="URL изображения" value={photoUrlInput} onChange={e=>setPhotoUrlInput(e.target.value)} /><Button onClick={()=>{if(photoUrlInput) setBuildingDetails(p=>({...p, [`${building.id}_photo`]: photoUrlInput}))}}>Загрузить</Button></div></>)}</Card>)}
        </div>
    );
}