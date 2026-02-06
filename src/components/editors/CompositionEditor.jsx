import React, { useState, useMemo } from 'react';
import { 
  Home, Car, Box, Pencil, Trash2, X, Sparkles, Building2, 
  Clock, ArrowRight, Layers, AlertCircle, Eye, Loader2, Hash // <--- Добавлен Hash
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDirectBuildings } from '../../hooks/api/useDirectBuildings';
import { Button, Input, Select, Label, SectionTitle, useReadOnly } from '../ui/UIKit';
import { getStageColor } from '../../lib/utils';
import { BuildingModalSchema } from '../../lib/schemas';
import { useValidation } from '../../hooks/useValidation';
import { useCatalog } from '../../hooks/useCatalogs';

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


const PARKING_CONSTRUCTION_FALLBACK = [
    { code: 'capital', label: 'Капитальный' },
    { code: 'light', label: 'Из легких конструкций' },
    { code: 'open', label: 'Открытый' }
];

// Хелпер генерации блоков для payload
const generateBlocksPayload = (params) => {
    const blocks = [];
    const { category, resBlocks, nonResBlocks, infraType, parkingType } = params;

    if (category.includes('residential')) {
        const rCount = parseInt(resBlocks) || 0;
        const nCount = parseInt(nonResBlocks) || 0;

        for (let i = 0; i < rCount; i++) {
            blocks.push({
                id: crypto.randomUUID(),
                type: 'residential',
                label: rCount > 1 ? `Жилая секция ${i + 1}` : 'Жилой дом',
                index: i
            });
        }
        for (let i = 0; i < nCount; i++) {
            blocks.push({
                id: crypto.randomUUID(),
                type: 'non_residential',
                label: `Нежилая секция ${i + 1}`,
                index: rCount + i
            });
        }
    } 
    else if (category === 'parking_separate') {
        blocks.push({
            id: crypto.randomUUID(),
            type: 'parking',
            label: parkingType === 'underground' ? 'Подземный паркинг' : 'Наземный паркинг',
            index: 0
        });
    } 
    else if (category === 'infrastructure') {
        blocks.push({
            id: crypto.randomUUID(),
            type: 'infrastructure',
            label: infraType || 'Объект инфраструктуры',
            index: 0
        });
    }

    return blocks;
};

const BuildingModal = ({ modal, setModal, onCommit, isSaving, parkingTypeOptions, parkingConstructionOptions, infraTypeOptions, projectStageOptions }) => {
    const isReadOnly = useReadOnly();
    
    const { errors, isValid } = useValidation(BuildingModalSchema, {
        baseName: modal.baseName,
        houseNumber: modal.houseNumber,
        category: modal.category || '',
        quantity: modal.quantity,
        resBlocks: modal.resBlocks,
        nonResBlocks: modal.nonResBlocks,
        hasNonResPart: modal.hasNonResPart,
        stage: modal.stage,
        dateStart: modal.dateStart,
        dateEnd: modal.dateEnd,
        parkingType: modal.parkingType,
        parkingConstruction: modal.parkingConstruction,
        infraType: modal.infraType
    });

    const isMultiblockError = modal.category === 'residential_multiblock' && (modal.resBlocks < 1 || modal.nonResBlocks < 1);
    const ErrorMsg = ({ field }) => errors[field] ? <span className="text-[9px] text-red-500 font-bold ml-1 animate-in fade-in">{errors[field]}</span> : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/20 animate-in zoom-in-95 duration-200">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">{modal.editingId ? (isReadOnly ? "Просмотр объекта" : "Редактирование объекта") : "Создание объекта"}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">Паспортные данные строения</p>
                    </div>
                    <button onClick={() => setModal(m => ({...m, isOpen: false}))} className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-white shadow-sm border border-slate-200">
                        <X size={20} className="text-slate-400 hover:text-slate-700"/>
                    </button>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* ЛЕВАЯ КОЛОНКА */}
                    <div className="space-y-5">
                        <SectionTitle icon={Hash}>Идентификация</SectionTitle>
                        <div className="space-y-1.5">
                            <Label>Номер дома / Корпус <span className="text-red-500">*</span> <ErrorMsg field="houseNumber"/></Label>
                            <div className="relative">
                                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <Input 
                                    value={modal.houseNumber} 
                                    onChange={(e) => setModal(m => ({...m, houseNumber: e.target.value}))} 
                                    placeholder="12А" 
                                    className={`pl-9 font-bold text-lg uppercase ${errors.houseNumber ? 'border-red-300 bg-red-50' : ''}`}
                                    autoFocus={!isReadOnly}
                                    disabled={isReadOnly || isSaving}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Наименование <ErrorMsg field="baseName"/></Label>
                            <Input 
                                value={modal.baseName} 
                                onChange={(e) => setModal(m => ({...m, baseName: e.target.value}))} 
                                placeholder="Например: Отдельный жилой дом"
                                className={errors.baseName ? 'border-red-300 bg-red-50' : ''}
                                disabled={isReadOnly || isSaving}
                            />
                        </div>
                        {!modal.editingId && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-center">
                                    <Label className="mb-0">Количество копий</Label>
                                    <div className="flex items-center gap-3">
                                        <button disabled={isReadOnly || isSaving} onClick={() => setModal(m => ({...m, quantity: Math.max(1, m.quantity - 1)}))} className="w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center font-bold text-slate-500 hover:text-blue-600 disabled:opacity-50">-</button>
                                        <span className="font-bold text-lg w-4 text-center">{modal.quantity}</span>
                                        <button disabled={isReadOnly || isSaving} onClick={() => setModal(m => ({...m, quantity: Math.min(20, m.quantity + 1)}))} className="w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center font-bold text-slate-500 hover:text-blue-600 disabled:opacity-50">+</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ПРАВАЯ КОЛОНКА */}
                    <div className="space-y-5">
                        <SectionTitle icon={Clock}>Параметры и Сроки</SectionTitle>
                        {modal.category === 'residential_multiblock' && (
                            <div className={`flex flex-col gap-3 p-3 rounded-xl border transition-colors animate-in fade-in ${isMultiblockError ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label>Жилых блоков</Label>
                                        <Input type="number" min="0" value={modal.resBlocks} onChange={(e) => setModal(m => ({...m, resBlocks: Math.max(0, parseInt(e.target.value)||0)}))} disabled={modal.editingId || isSaving} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Нежилых</Label>
                                        <Input type="number" min="0" value={modal.nonResBlocks} onChange={(e) => setModal(m => ({...m, nonResBlocks: Math.max(0, parseInt(e.target.value)||0)}))} disabled={modal.editingId || isSaving} />
                                    </div>
                                </div>
                                {modal.editingId && <div className="text-[10px] text-slate-500 italic">Изменение структуры блоков доступно только при создании.</div>}
                                {isMultiblockError && (
                                    <div className="flex items-start gap-2 text-[10px] text-red-600 font-bold leading-tight">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5"/>
                                        <span>Необходимо минимум: 1 жилой и 1 нежилой блок.</span>
                                    </div>
                                )}
                            </div>
                        )}
                        {modal.category === 'parking_separate' && (
                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in">
                                <div className="space-y-1.5">
                                    <Label>Тип паркинга</Label>
                                    <Select
                                        value={modal.parkingType}
                                        onChange={e => {
                                            const nextType = e.target.value;
                                            setModal(m => ({
                                                ...m,
                                                parkingType: nextType,
                                                parkingConstruction: nextType === 'underground' ? 'capital' : m.parkingConstruction
                                            }));
                                        }}
                                        disabled={isReadOnly || isSaving}
                                    >
                                        {parkingTypeOptions.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                                    </Select>
                                </div>
                                {(modal.parkingType === 'ground' || modal.parkingType === 'aboveground') && (
                                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                                        <Label>Конструктив</Label>
                                        <Select value={modal.parkingConstruction} onChange={e => setModal(m => ({...m, parkingConstruction: e.target.value}))} disabled={isReadOnly || isSaving}>
                                            {parkingConstructionOptions.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}
                        {modal.category === 'infrastructure' && (
                            <div className="space-y-1.5 p-3 bg-amber-50 rounded-xl border border-amber-100 animate-in fade-in">
                                <Label>Тип объекта</Label>
                                <Select value={modal.infraType} onChange={(e) => setModal(m => ({...m, infraType: e.target.value}))} disabled={isReadOnly || isSaving}>
                                    {infraTypeOptions.map(opt => <option key={opt.code} value={opt.label}>{opt.label}</option>)}
                                </Select>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label>Текущая стадия</Label>
                            <Select value={modal.stage} onChange={e => setModal(m => ({...m, stage: e.target.value}))} disabled={isReadOnly || isSaving}>
                                {projectStageOptions.map(opt => <option key={opt.code} value={opt.label}>{opt.label}</option>)}
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>Начало работ</Label>
                                <Input type="date" value={modal.dateStart} onChange={(e) => setModal(m => ({...m, dateStart: e.target.value}))} className="text-xs font-bold" disabled={isReadOnly || isSaving}/>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Ввод в экспл.</Label>
                                <Input type="date" value={modal.dateEnd} onChange={(e) => setModal(m => ({...m, dateEnd: e.target.value}))} className="text-xs font-bold" disabled={isReadOnly || isSaving}/>
                            </div>
                        </div>
                        {modal.category?.includes('residential') && (
                            <div className="pt-2 border-t border-slate-100 mt-2">
                                <label className={`flex items-start gap-3 group ${isReadOnly || isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={modal.hasNonResPart} 
                                        onChange={(e) => setModal(m => ({...m, hasNonResPart: e.target.checked}))} 
                                        disabled={isReadOnly || isSaving}
                                        className="mt-1 w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 disabled:cursor-not-allowed"
                                    />
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
                    <Button variant="ghost" onClick={() => setModal(m => ({...m, isOpen: false}))} disabled={isReadOnly || isSaving}>
                        {isReadOnly ? 'Закрыть' : 'Отмена'}
                    </Button>
                    {!isReadOnly && (
                        <Button onClick={onCommit} disabled={!isValid || isMultiblockError || isSaving} className={`shadow-xl shadow-blue-200/50 px-8 ${(!isValid || isMultiblockError) ? 'opacity-50 cursor-not-allowed bg-slate-400' : ''}`}>
                            {isSaving ? <Loader2 size={18} className="animate-spin mr-2"/> : <ArrowRight size={18} className="mr-2"/>}
                            {isSaving ? 'Сохранение...' : 'Применить'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function CompositionEditor() {
    const { projectId } = useProject(); 
    const isReadOnly = useReadOnly();

    const { buildings, isLoading, createBuilding, updateBuilding, deleteBuilding, isMutating } = useDirectBuildings(projectId);

    const [modal, setModal] = useState({ 
        isOpen: false, category: null, quantity: 1, 
        resBlocks: 1, nonResBlocks: 0, hasNonResPart: false, 
        baseName: "", houseNumber: "", dateStart: "", dateEnd: "", stage: "Проектный",
        editingId: null, parkingType: 'ground', parkingConstruction: 'light', infraType: 'Котельная' 
    });

    const hasResidential = useMemo(() => buildings.some(c => c.category.includes('residential')), [buildings]);

    const { options: parkingTypeOptions } = useCatalog('dict_parking_types');
    const { options: parkingConstructionOptions } = useCatalog('dict_parking_construction_types');

    const normalizedParkingConstructionOptions = useMemo(() => {
        const byCode = new Map((parkingConstructionOptions || []).map(opt => [opt.code, opt]));

        return PARKING_CONSTRUCTION_FALLBACK.map((fallback) => ({
            code: fallback.code,
            label: byCode.get(fallback.code)?.label || fallback.label
        }));
    }, [parkingConstructionOptions]);
    const { options: infraTypeOptions } = useCatalog('dict_infra_types');
    const { options: projectStageOptions } = useCatalog('dict_project_statuses');

    const generateDemoComplex = async () => {
        if (!window.confirm("Создать демо-данные в БД?")) return;
        
        try {
            await createBuilding({
                buildingData: {
                    label: 'Корпус "Доминанта"', houseNumber: "1", stage: "Строящийся", 
                    category: 'residential', hasNonResPart: true
                },
                blocksData: generateBlocksPayload({ category: 'residential', resBlocks: 1 })
            });
            await createBuilding({
                buildingData: {
                    label: 'Паркинг "Север"', houseNumber: "P-1", stage: "Введенный", 
                    category: 'parking_separate', parkingType: 'ground', constructionType: 'capital'
                },
                blocksData: generateBlocksPayload({ category: 'parking_separate', parkingType: 'ground' })
            });
        } catch (e) {
            console.error(e);
            alert("Ошибка при создании демо-данных");
        }
    };

    const openPlanning = (category) => {
        const defaultName = TYPE_NAMES[category] || "Новый объект";
        setModal({ 
            isOpen: true, category, quantity: 1, 
            resBlocks: category.includes('multiblock') ? 1 : (category.includes('residential') ? 1 : 0), 
            nonResBlocks: category.includes('multiblock') ? 1 : 0, 
            hasNonResPart: false, baseName: defaultName, houseNumber: "",
            dateStart: "", dateEnd: "", stage: "Проектный",
            parkingType: 'ground', parkingConstruction: 'light', infraType: 'Котельная', editingId: null 
        });
    };

    const openEditing = (item) => {
        setModal({ 
            isOpen: true, editingId: item.id,
            category: item.category, quantity: 1,
            resBlocks: item.resBlocks || 0, nonResBlocks: item.nonResBlocks || 0,
            hasNonResPart: item.hasNonResPart || false, baseName: item.label, houseNumber: item.houseNumber,
            dateStart: item.dateStart || "", dateEnd: item.dateEnd || "", stage: item.stage || "Проектный",
            parkingType: item.parkingType || 'ground', parkingConstruction: item.constructionType || 'capital',
            infraType: item.infraType || 'Котельная',
        });
    };
    
    const commitPlanning = async () => {
         const isParking = modal.category === 'parking_separate';
         const isInfrastructure = modal.category === 'infrastructure';

         const isAbovegroundParking = modal.parkingType === 'ground' || modal.parkingType === 'aboveground';
         const buildingData = {
             label: modal.baseName,
             houseNumber: modal.houseNumber,
             category: modal.category,
             constructionType: isParking ? (isAbovegroundParking ? modal.parkingConstruction : 'capital') : null,
             parkingType: isParking ? modal.parkingType : null,
             infraType: isInfrastructure ? modal.infraType : null,
             hasNonResPart: modal.hasNonResPart,
             // Пробрасываем эти поля, даже если их нет в базовой схеме buildings, 
             // так как api-service может использовать их для записи в building_blocks или мета-таблицы
             stage: modal.stage,
             dateStart: modal.dateStart,
             dateEnd: modal.dateEnd
         };

         if (modal.editingId) {
             await updateBuilding({ id: modal.editingId, data: buildingData });
         } else {
             for (let i = 0; i < modal.quantity; i++) {
                 const label = modal.quantity > 1 ? `${modal.baseName} ${i+1}` : modal.baseName;
                 const blocks = generateBlocksPayload(modal);
                 
                 await createBuilding({
                     buildingData: { ...buildingData, label },
                     blocksData: blocks
                 });
             }
         }
         setModal(prev => ({...prev, isOpen: false}));
    };
    
    const deleteItem = (id) => {
        if (confirm("Удалить объект и все связанные данные (блоки, этажи, квартиры)?")) {
            deleteBuilding(id);
        }
    };

    if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;

    return (
        <div className="w-full px-6 pb-20 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-2 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Состав комплекса</h1>
                    <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">Создание и управление перечнем строений</p>
                </div>
                <div className="flex gap-3">
                     <Button onClick={generateDemoComplex} disabled={isReadOnly || isMutating} variant="secondary" className={`bg-white border border-slate-200 transition-all shadow-sm ${isReadOnly ? 'opacity-50 cursor-not-allowed text-slate-400' : 'hover:bg-purple-50 hover:text-purple-600'}`}>
                        <Sparkles size={16} /> Демо-данные
                    </Button>
                     <div className="h-10 px-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center shadow-lg shadow-slate-900/20">{buildings.length} объектов</div>
                </div>
            </div>

            {!isReadOnly && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase mr-2">Создать:</span>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'residential', label: 'Жилой дом', icon: Home, color: 'text-slate-700 bg-white border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:shadow-md' },
                            { id: 'residential_multiblock', label: 'Многоблочный', icon: Layers, color: 'text-slate-700 bg-white border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md' },
                            { id: 'parking_separate', label: 'Паркинг', icon: Car, color: 'text-slate-700 bg-white border-slate-200 hover:border-slate-400 hover:text-slate-900 hover:shadow-md' },
                            { id: 'infrastructure', label: 'Инфраструктура', icon: Box, color: 'text-slate-700 bg-white border-slate-200 hover:border-amber-400 hover:text-amber-600 hover:shadow-md' }
                        ].map(btn => (
                            <button key={btn.id} onClick={() => openPlanning(btn.id)} disabled={isMutating} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-sm ${btn.color}`}>
                                <btn.icon size={14} />{btn.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!hasResidential && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in">
                    <div className="p-2 bg-white rounded-full shadow-sm border border-red-100 text-red-500"><AlertCircle size={20} /></div>
                    <div><h4 className="text-sm font-bold">Необходимо добавить жилой дом</h4><p className="text-xs opacity-80 mt-0.5">В проекте должен быть минимум один жилой или многоблочный дом для продолжения работы.</p></div>
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
                <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-200 py-4 pl-6 pr-4 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-1 text-center">Дом №</div>
                    <div className="col-span-3">Наименование</div>
                    <div className="col-span-3">Характеристики</div>
                    <div className="col-span-2">Статус</div>
                    <div className="col-span-1 text-right">Ред.</div>
                    <div className="col-span-1 text-right">Действия</div>
                </div>

                {buildings.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300"><Building2 size={32} /></div>
                        <h3 className="text-sm font-bold text-slate-700">Список объектов пуст</h3>
                        <p className="text-xs text-slate-400 mt-1">Используйте кнопки сверху для создания</p>
                    </div>
                )}

                <div className="divide-y divide-slate-100">
                    {buildings.map((item, idx) => {
                        const isRes = item.category.includes('residential');
                        let detailsBadge = null;
                        if (item.category === 'parking_separate') {
                            const pType = (item.parkingType === 'ground' || item.parkingType === 'aboveground') ? 'Наземный' : 'Подземный';
                            const pConstName = PARKING_CONSTRUCTION_NAMES[item.constructionType] || item.constructionType;
                            detailsBadge = `${pType} • ${pConstName}`;
                        }

                        return (
                            <div key={item.id} className="grid grid-cols-12 items-center py-4 pl-6 pr-4 hover:bg-blue-50/50 transition-colors group even:bg-slate-50/50">
                                <div className="col-span-1 text-xs font-bold text-slate-400 text-center">{idx + 1}</div>
                                <div className="col-span-1 flex justify-center">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shadow-sm border ${isRes ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-amber-700'}`}>{item.houseNumber || '?'}</div>
                                </div>
                                <div className="col-span-3 pr-4">
                                    <div className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{item.label}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{TYPE_NAMES[item.category] || item.category}</div>
                                </div>
                                <div className="col-span-3 pr-4 flex flex-col justify-center gap-1.5">
                                    <div className="flex flex-wrap gap-1">
                                        {(item.resBlocks > 0 || item.nonResBlocks > 0) && <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px] font-bold text-slate-600">{item.resBlocks} жил. / {item.nonResBlocks} нежил.</span>}
                                        {item.hasNonResPart && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded text-[10px] font-bold">Коммерция</span>}
                                        {item.category === 'infrastructure' && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold">{item.infraType}</span>}
                                        {detailsBadge && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">{detailsBadge}</span>}
                                    </div>
                                </div>
                                <div className="col-span-2 pr-4">
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${getStageColor(item.stage)}`}>
                                        {item.stage || 'Проект'}
                                    </span>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                    <button
                                        onClick={() => openEditing(item)}
                                        title={isReadOnly ? 'Просмотр' : 'Редактировать'}
                                        className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold shadow-sm hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                    >
                                        {isReadOnly ? <Eye size={14} /> : <Pencil size={14} />}
                                        <span>{isReadOnly ? 'Просм.' : 'Ред.'}</span>
                                    </button>
                                </div>
                                <div className="col-span-1 flex justify-end gap-1">
                                    <button
                                        onClick={() => openEditing(item)}
                                        title="Открыть"
                                        className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                                    >
                                        <ArrowRight size={14} />
                                    </button>
                                    {!isReadOnly && (
                                        <button
                                            onClick={() => deleteItem(item.id)}
                                            title="Удалить"
                                            className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm flex items-center justify-center hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {modal.isOpen && <BuildingModal modal={modal} setModal={setModal} onCommit={commitPlanning} isSaving={isMutating} parkingTypeOptions={parkingTypeOptions} parkingConstructionOptions={normalizedParkingConstructionOptions} infraTypeOptions={infraTypeOptions} projectStageOptions={projectStageOptions} />}
        </div>
    );
}
