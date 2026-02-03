import React, { useMemo, useState, useEffect } from 'react';
import { 
  Search, Home, Briefcase, 
  Layers, Car, Building2,
  FileText, LayoutGrid, Loader2, CheckCircle2, School, Filter,
  Activity
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, useReadOnly, Input } from '../ui/UIKit';
import { getBlocksList } from '../../lib/utils';
import UnitInventoryModal from './UnitInventoryModal'; 
import ParkingEditModal from './ParkingEditModal'; 

const MODES = {
    apartments: {
        title: 'Реестр квартир',
        description: 'Жилой фонд: только квартиры и дуплексы',
        icon: Home,
        colorClass: 'text-blue-600',
    },
    commercial: {
        title: 'Реестр нежилых помещений',
        description: 'Коммерция, нежилые блоки и инфраструктура',
        icon: Briefcase,
        colorClass: 'text-emerald-600',
    },
    parking: {
        title: 'Реестр машиномест',
        description: 'Парковочные места в паркингах и подвалах',
        icon: Car,
        colorClass: 'text-indigo-600',
    }
};

const getTypeConfig = (type) => {
    switch(type) {
        case 'flat': return { label: 'Квартира', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Home };
        case 'duplex_up': return { label: 'Дуплекс (В)', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
        case 'duplex_down': return { label: 'Дуплекс (Н)', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Layers };
        case 'office': return { label: 'Офис', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Briefcase };
        case 'office_inventory': return { label: 'Нежилое (Инв.)', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: FileText };
        case 'non_res_block': return { label: 'Нежилой блок', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Building2 };
        case 'infrastructure': return { label: 'Инфраструктура', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: School };
        case 'parking_place': return { label: 'М/М', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Car };
        default: return { label: type, color: 'bg-slate-100 text-slate-600', icon: FileText };
    }
};

const DarkTabButton = ({ active, onClick, children, icon: Icon }) => (
    <button
        onClick={onClick}
        className={`
            px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${active 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400" 
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            }
        `}
    >
        {Icon && <Icon size={14} className={active ? "text-blue-200" : "opacity-70"}/>}
        {children}
    </button>
);

const StatCard = ({ label, value, icon: Icon, colorClass, iconBgClass }) => (
    <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm bg-white ${colorClass}`}>
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            <p className="text-2xl font-black mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${iconBgClass || 'bg-slate-100'}`}>
            <Icon size={20} className="opacity-80"/>
        </div>
    </div>
);

const FilterSelect = ({ value, onChange, options, placeholder, icon: Icon }) => (
    <div className="relative w-full md:w-36 lg:w-40">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full h-10 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 appearance-none cursor-pointer ${Icon ? 'pl-9' : 'pl-3'} pr-8 truncate transition-all`}
        >
            <option value="all">{placeholder}</option>
            {options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </div>
    </div>
);

export default function UnitRegistry({ mode = 'apartments' }) {
    const { 
        composition, flatMatrix, setFlatMatrix, floorData, 
        parkingPlaces, setParkingPlaces, entrancesData, 
        complexInfo, saveProjectImmediate, buildingDetails 
    } = useProject();
    
    const isReadOnly = useReadOnly();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBuilding, setFilterBuilding] = useState('all');
    
    const [filterEntrance, setFilterEntrance] = useState('all');
    const [filterFloor, setFilterFloor] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    const [editingUnit, setEditingUnit] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const modeConfig = MODES[mode] || MODES.apartments;
    const ModeIcon = modeConfig.icon;

    useEffect(() => {
        setFilterEntrance('all');
        setFilterFloor('all');
        setFilterStatus('all');
    }, [filterBuilding]);

    // --- ЛОГИКА СБОРА ДАННЫХ ---
    const dataObjects = useMemo(() => {
        const list = [];
        
        // 1. Создаем Set для проверки дубликатов (для коммерции)
        const registeredUnits = new Set();

        const addToIndex = (item) => {
            // Нормализуем ключ для индекса
            const key = `${item.buildingId}_${item.blockId}_${item.entrance}_${item.number}`;
            registeredUnits.add(key);
        };

        const isRegistered = (bId, blId, ent, num) => {
            const key = `${bId}_${blId}_${ent}_${num}`;
            return registeredUnits.has(key);
        };

        // Хелпер для поиска названия этажа
        const resolveFloorLabel = (buildingId, floorId) => {
            if (!floorId) return '-';
            // 1. Ищем в базе floorData
            // Проблема: мы не знаем blockId здесь, поэтому ищем по суффиксу ID
            const entry = Object.values(floorData).find(f => f.id === floorId && f.buildingId === buildingId);
            if (entry) return entry.label;

            // 2. Парсим ID
            if (floorId.includes('floor_')) return `${floorId.replace('floor_', '')} этаж`;
            if (floorId.includes('minus')) return `Уровень -${floorId.split('minus_')[1]}`;
            if (floorId.includes('base_')) return 'Подвал';
            if (floorId === 'roof') return 'Кровля';
            if (floorId === 'attic') return 'Мансарда';
            if (floorId === 'tsokol') return 'Цоколь';
            
            // Если это просто число
            if (!isNaN(parseInt(floorId))) return `${floorId} этаж`;

            return '-';
        };

        composition.forEach(building => {
            const blocks = getBlocksList(building, buildingDetails);

            // === ШАГ 1: СБОР СОХРАНЕННЫХ ОБЪЕКТОВ (FlatMatrix) ===
            if (mode === 'apartments' || mode === 'commercial') {
                Object.keys(flatMatrix).forEach(key => {
                    if (!key.startsWith(building.id)) return;
                    
                    const unit = flatMatrix[key];
                    if (!unit || !unit.num) return; 

                    // Фильтрация по типу
                    const isLiving = ['flat', 'duplex_up', 'duplex_down'].includes(unit.type);
                    const isCommercialType = ['office', 'office_inventory', 'non_res_block', 'infrastructure'].includes(unit.type);

                    if (mode === 'apartments' && !isLiving) return;
                    if (mode === 'commercial' && !isCommercialType) return;

                    // --- ПАРСИНГ КЛЮЧА (ВОССТАНОВЛЕН И УЛУЧШЕН) ---
                    // Пытаемся получить данные из самого объекта, если нет - из ключа
                    let entrance = unit.entrance;
                    let floorId = unit.floorId;
                    let blockId = unit.blockId;

                    if (!floorId || !entrance || !blockId) {
                        // Regex: Найти _e(цифры) _f(что-угодно) _i(цифры)
                        // Это покрывает ключи типа: b1_blk1_e1_f_floor_1_i0 и b1_blk1_e1_f1_i0
                        const match = key.match(/_e(\d+)_f(.*)_i(\d+)/);
                        
                        if (match) {
                            if (!entrance) entrance = match[1];
                            if (!floorId) floorId = match[2]; // Это может быть "floor_1" или "1"

                            // Пытаемся вытащить blockId (все что между buildingId и _e)
                            if (!blockId) {
                                const suffixIndex = key.indexOf(`_e${entrance}_f`);
                                if (suffixIndex > -1) {
                                    // key: "dom1_blk1_e1..." -> prefix: "dom1_blk1"
                                    const prefix = key.substring(0, suffixIndex);
                                    if (prefix.startsWith(building.id + '_')) {
                                        blockId = prefix.substring(building.id.length + 1);
                                    }
                                }
                            }
                        }
                    }

                    // Чистка floorId от дублей (если парсер захватил лишнее)
                    if (floorId && floorId.startsWith('_')) floorId = floorId.substring(1);

                    // Определение названий
                    const floorLabel = resolveFloorLabel(building.id, floorId);
                    let blockLabel = unit.blockLabel || 'Секция';
                    
                    if (blockId) {
                        const bObj = blocks.find(b => b.id === blockId);
                        if (bObj) blockLabel = bObj.tabLabel;
                    }

                    const item = {
                        ...unit,
                        id: key, 
                        uuid: unit.id || (key.length > 30 ? key : null),
                        buildingId: building.id,
                        blockId: blockId,
                        floorId: floorId,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        address: complexInfo.street,
                        
                        number: unit.num,
                        area: unit.area || '0',           
                        livingArea: unit.livingArea || '0', 
                        usefulArea: unit.usefulArea || '0', 
                        
                        explication: unit.explication || [], 

                        blockLabel: blockLabel,
                        floorLabel: floorLabel,
                        entrance: entrance || '-',
                        
                        isSaved: true 
                    };

                    list.push(item);
                    if (blockId && entrance && unit.num) {
                        addToIndex(item);
                    }
                });
            }

            // === ШАГ 2: ГЕНЕРАЦИЯ ВИРТУАЛЬНЫХ (Commercial) ===
            if (mode === 'commercial') {
                const resBlocks = blocks.filter(b => b.type === 'Ж');
                resBlocks.forEach(block => {
                    Object.keys(entrancesData).forEach(entKey => {
                        if (!entKey.startsWith(block.fullId)) return;
                        const data = entrancesData[entKey];
                        const unitsCount = parseInt(data.units || 0);
                        if (unitsCount > 0) {
                            const entMatch = entKey.match(/_ent(\d+)_(.*)$/);
                            if (entMatch) {
                                const entIdx = entMatch[1];
                                const floorId = entMatch[2];
                                const floorLabel = resolveFloorLabel(building.id, floorId);
                                
                                for(let i = 1; i <= unitsCount; i++) {
                                    const candidateNumber = `НП-${i}`;
                                    
                                    // ПРОВЕРКА НА ДУБЛИКАТ
                                    if (isRegistered(building.id, block.id, entIdx, candidateNumber)) {
                                        continue; 
                                    }

                                    const virtualId = `${entKey}_unit_${i}`; 
                                    list.push({
                                        id: virtualId, 
                                        buildingId: building.id,
                                        blockId: block.id,
                                        floorId: floorId,
                                        houseNumber: building.houseNumber,
                                        buildingLabel: building.label,
                                        address: complexInfo.street,
                                        number: candidateNumber, 
                                        type: 'office_inventory',
                                        area: '0', 
                                        livingArea: '0',
                                        usefulArea: '0',
                                        rooms: '-',
                                        explication: [],
                                        blockLabel: block.tabLabel,
                                        floorLabel: floorLabel,
                                        entrance: entIdx,
                                        isSaved: false 
                                    });
                                }
                            }
                        }
                    });
                });
            }

            // ШАГ 3: ПАРКИНГ
            else if (mode === 'parking') {
                Object.keys(parkingPlaces).forEach(key => {
                    if (!key.startsWith(building.id) || !key.includes('_place')) return;
                    const place = parkingPlaces[key];
                    
                    // Парсинг паркинга проще
                    let floorId = null;
                    if (key.includes('level_minus_')) floorId = 'level_minus_' + key.split('level_minus_')[1].split('_')[0];
                    else if (key.includes('_floor_')) floorId = 'floor_' + key.split('_floor_')[1].split('_')[0];
                    else if (key.includes('_base_')) {
                         const m = key.match(/_L(\d+)/);
                         floorId = m ? `base_L${m[1]}` : 'base';
                    }

                    const floorLabel = resolveFloorLabel(building.id, floorId) || 'Уровень';

                    list.push({
                        ...place,
                        id: key,
                        buildingId: building.id,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        floorLabel: floorLabel,
                        entrance: '-', 
                        area: place.area || '13.25',
                        livingArea: '-',
                        usefulArea: '-',
                        uuid: place.id || null, 
                        isSaved: true
                    });
                });
            }
        });

        return list.sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
    }, [composition, flatMatrix, floorData, parkingPlaces, entrancesData, complexInfo, mode, buildingDetails]);

    // --- ФИЛЬТРАЦИЯ ---
    const filteredData = useMemo(() => {
        return dataObjects.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = String(item.number).toLowerCase().includes(searchLower) || 
                                  String(item.houseNumber).toLowerCase().includes(searchLower);
            
            const matchesBuilding = filterBuilding === 'all' || item.buildingId === filterBuilding;
            const matchesEntrance = filterEntrance === 'all' || String(item.entrance) === String(filterEntrance);
            const matchesFloor = filterFloor === 'all' || item.floorLabel === filterFloor;

            let matchesStatus = true;
            if (filterStatus !== 'all') {
                const isFilled = parseFloat(item.area) > 0;
                if (filterStatus === 'Готов') matchesStatus = isFilled;
                else if (filterStatus === 'Не готов') matchesStatus = !isFilled;
            }

            return matchesSearch && matchesBuilding && matchesEntrance && matchesFloor && matchesStatus;
        });
    }, [dataObjects, searchTerm, filterBuilding, filterEntrance, filterFloor, filterStatus]);

    // --- ОПЦИИ ФИЛЬТРОВ ---
    const availableOptions = useMemo(() => {
        const contextData = filterBuilding === 'all' 
            ? dataObjects 
            : dataObjects.filter(d => d.buildingId === filterBuilding);

        const entrances = [...new Set(contextData.map(d => d.entrance).filter(e => e && e !== '-'))]
            .sort((a, b) => parseInt(a) - parseInt(b));
        
        const floors = [...new Set(contextData.map(d => d.floorLabel).filter(f => f && f !== '-'))]
            .sort((a, b) => {
                const numA = parseInt(a);
                const numB = parseInt(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });

        return { entrances, floors };
    }, [dataObjects, filterBuilding]);

    const stats = useMemo(() => {
        const total = filteredData.length;
        const totalArea = filteredData.reduce((acc, item) => acc + (parseFloat(item.area) || 0), 0);
        return { total, totalArea };
    }, [filteredData]);

    // --- СОХРАНЕНИЕ ---
    const handleSaveUnit = async (changes) => {
        if (!editingUnit || isReadOnly) return;
        setIsSaving(true);

        const sourceData = mode === 'parking' ? parkingPlaces : flatMatrix;
        const setSourceData = mode === 'parking' ? setParkingPlaces : setFlatMatrix;
        
        // 1. Получаем существующие данные (если есть)
        const existingData = editingUnit.isSaved ? sourceData[editingUnit.id] : {};

        // 2. Слияние экспликации (комнат)
        // Приоритет: Changes > EditingUnit > ExistingData > []
        let finalExplication = [];
        if (Array.isArray(changes.explication)) finalExplication = changes.explication;
        else if (Array.isArray(editingUnit.explication)) finalExplication = editingUnit.explication;
        else if (existingData && Array.isArray(existingData.explication)) finalExplication = existingData.explication;

        const finalId = editingUnit.uuid || crypto.randomUUID();

        // 3. Формируем единый объект (Тройное слияние для надежности)
        // existingData - чтобы не потерять старые поля
        // editingUnit - чтобы получить blockId/floorId для новых объектов
        // changes - чтобы применить новые значения
        const mergedData = { ...existingData, ...editingUnit, ...changes };

        const cleanPayload = {
            id: finalId,
            isSaved: true,
            
            num: mergedData.number,
            number: mergedData.number,
            area: mergedData.area || '0',
            livingArea: mergedData.livingArea || '0',
            usefulArea: mergedData.usefulArea || '0',
            type: mergedData.type,
            rooms: mergedData.rooms,
            
            explication: finalExplication,

            // Критически важно для привязки
            buildingId: mergedData.buildingId,
            blockId: mergedData.blockId,
            floorId: mergedData.floorId,
            entrance: mergedData.entrance
        };

        // Удаляем UI-поля
        delete cleanPayload.floorLabel;
        delete cleanPayload.blockLabel;
        delete cleanPayload.buildingLabel;
        delete cleanPayload.houseNumber;
        delete cleanPayload.address;
        delete cleanPayload.uuid;
        delete cleanPayload.isInvalid;

        try {
            // Если это виртуальный объект, мы сохраняем его под UUID,
            // но в стейте ключом может быть старый строковый ID (editingUnit.id).
            // Чтобы он заменил виртуальный в списке, мы должны обновить стейт.
            
            // Нюанс: если мы сохраняем под UUID, то виртуальный ключ останется в стейте?
            // Нет, виртуальные ключи генерируются на лету в dataObjects.
            // Нам нужно просто добавить в flatMatrix запись с ключом = editingUnit.id (чтобы перезаписать)
            // ИЛИ добавить новую запись.
            
            // Если редактировали виртуальный объект (id = "..._unit_1"), лучше сохранить его под этим же ключом,
            // чтобы он перестал быть "виртуальным" и стал "реальным".
            // ИЛИ использовать UUID как ключ. 
            // В нашей системе ключи flatMatrix обычно: buildingId_blockId_...
            // Давайте сохраним под editingUnit.id, если это "новый" объект, чтобы он перекрыл генерацию.
            
            const keyToSave = editingUnit.id; 
            
            setSourceData(prev => ({ ...prev, [keyToSave]: cleanPayload }));
            
            setTimeout(async () => {
                try {
                    await saveProjectImmediate();
                } catch (e) { 
                    console.error("Firebase save error:", e); 
                }
            }, 300);
            
        } catch (error) {
            console.error("Auto-save failed:", error);
        } finally {
            setIsSaving(false);
            setEditingUnit(null);
        }
    };

    return (
        <div className="w-full px-4 md:px-6 2xl:px-8 max-w-[2400px] mx-auto pb-20 animate-in fade-in duration-500 space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-200 pb-6 px-4 md:px-0">
                <div>
                    <h1 className={`text-2xl font-bold flex items-center gap-3 ${modeConfig.colorClass}`}>
                        <ModeIcon /> {modeConfig.title}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">{modeConfig.description}</p>
                </div>
                {isSaving && <div className="flex items-center gap-2 text-blue-600 text-sm font-bold"><Loader2 className="animate-spin" size={16}/> Сохранение...</div>}
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-2 gap-4 px-4 md:px-0">
                <StatCard label={`Всего объектов`} value={stats.total} icon={LayoutGrid} colorClass="border-slate-200 text-slate-800" iconBgClass="bg-slate-100"/>
                <StatCard label="Общая площадь (м²)" value={stats.totalArea.toLocaleString(undefined, {maximumFractionDigits: 1})} icon={FileText} colorClass="border-blue-100 bg-blue-50 text-blue-700" iconBgClass="bg-blue-200"/>
            </div>

            {/* Панель фильтров */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 px-4 md:px-0">
                 <div className="flex items-center gap-1.5 p-1.5 bg-slate-800 rounded-xl w-full xl:w-max overflow-x-auto shadow-inner border border-slate-700 custom-scrollbar">
                    <DarkTabButton active={filterBuilding === 'all'} onClick={() => setFilterBuilding('all')} icon={LayoutGrid}>Все объекты</DarkTabButton>
                    <div className="w-px h-5 bg-slate-700 mx-1 shrink-0"></div>
                    {composition.map((b) => (
                        <DarkTabButton key={b.id} active={filterBuilding === b.id} onClick={() => setFilterBuilding(b.id)} icon={Building2}>
                            {b.label} <span className="opacity-50 text-[10px] ml-1">#{b.houseNumber}</span>
                        </DarkTabButton>
                    ))}
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                    {mode !== 'parking' && (
                        <FilterSelect 
                            icon={Filter}
                            value={filterEntrance}
                            onChange={setFilterEntrance}
                            options={availableOptions.entrances}
                            placeholder="Все подъезды"
                        />
                    )}
                    <FilterSelect 
                        icon={Layers}
                        value={filterFloor}
                        onChange={setFilterFloor}
                        options={availableOptions.floors}
                        placeholder="Все этажи"
                    />
                    <FilterSelect 
                        icon={Activity}
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={['Готов', 'Не готов']}
                        placeholder="Любой статус"
                    />
                    <div className="relative w-full md:w-48 lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Поиск по номеру..." className="pl-9 h-10 text-xs font-bold w-full"/>
                    </div>
                </div>
            </div>

            {/* Таблица */}
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 rounded-xl mx-4 md:mx-0">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800 text-slate-200 border-b border-slate-700 text-[10px] uppercase font-bold sticky top-0 z-20 shadow-md">
                            <tr>
                                <th className="p-4 w-12 text-center text-slate-400">№</th>
                                <th className="p-4 w-20 text-center">Дом</th>
                                <th className="p-4 w-20 text-center border-l border-slate-700">Подъезд</th>
                                <th className="p-4 w-32 text-center border-l border-slate-700">{mode === 'parking' ? 'Номер места' : (mode === 'commercial' ? 'Номер помещения' : 'Номер квартиры')}</th>
                                <th className="p-4 border-l border-slate-700">Тип</th>
                                <th className="p-4">Блок/Секция</th>
                                <th className="p-4 text-center">Этаж</th>
                                {mode === 'apartments' && <th className="p-4 text-center">Комнат</th>}
                                <th className="p-4 text-right bg-slate-700/50 text-emerald-300 border-l border-slate-700">Общая площадь (м²)</th>
                                {mode === 'apartments' && <th className="p-4 text-right border-l border-slate-700">Жилая площадь (м²)</th>}
                                {mode === 'apartments' && <th className="p-4 text-right border-l border-slate-700">Полезная площадь (м²)</th>}
                                <th className="p-4 text-center border-l border-slate-700">Статус</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-sm">
                            {filteredData.length > 0 ? (
                                filteredData.map((item, idx) => {
                                    const typeConf = getTypeConfig(item.type);
                                    const TypeIcon = typeConf.icon;
                                    const isFilled = parseFloat(item.area) > 0;
                                    return (
                                        <tr key={item.id} onClick={() => setEditingUnit(item)} className={`group cursor-pointer transition-colors border-b border-slate-100 last:border-0 hover:bg-blue-50 relative even:bg-slate-50/50`}>
                                            <td className="p-4 text-xs text-slate-400 text-center font-mono">{idx + 1}</td>
                                            <td className="p-4 text-center"><div className="inline-flex items-center justify-center w-8 h-8 rounded bg-white border border-slate-200 font-bold text-slate-700 text-xs shadow-sm">{item.houseNumber}</div></td>
                                            <td className="p-4 text-center font-bold text-slate-500 border-l border-slate-100">{item.entrance}</td>
                                            <td className="p-4 text-center relative border-x border-blue-100 bg-blue-50/20 group-hover:bg-blue-100/50 transition-colors"><span className="font-black text-slate-800 text-lg">{item.number}</span></td>
                                            <td className="p-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${typeConf.color}`}><TypeIcon size={12}/> {typeConf.label}</span></td>
                                            <td className="p-4 text-xs text-slate-500"><span className="font-bold text-slate-700">{item.blockLabel}</span></td>
                                            <td className="p-4 text-center font-medium text-slate-700">{item.floorLabel}</td>
                                            {mode === 'apartments' && <td className="p-4 text-center text-slate-500 font-medium">{item.rooms}</td>}
                                            <td className="p-4 text-right font-mono font-bold text-slate-800 bg-emerald-50/30 border-l border-emerald-100/50">{parseFloat(item.area).toFixed(2)}</td>
                                            {mode === 'apartments' && <td className="p-4 text-right font-mono text-slate-600 border-l border-slate-100">{parseFloat(item.livingArea) > 0 ? parseFloat(item.livingArea).toFixed(2) : '-'}</td>}
                                            {mode === 'apartments' && <td className="p-4 text-right font-mono text-slate-600 border-l border-slate-100">{parseFloat(item.usefulArea) > 0 ? parseFloat(item.usefulArea).toFixed(2) : '-'}</td>}
                                            <td className="p-4 text-center border-l border-slate-100">{isFilled ? (<div className="inline-flex items-center gap-1.5 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold"><CheckCircle2 size={14} className="text-emerald-500"/><span>Готов</span></div>) : (<span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">Не заполнен</span>)}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr><td colSpan={12} className="p-12 text-center text-slate-400">Нет объектов</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {editingUnit && (mode === 'apartments' || mode === 'commercial') && (
                <UnitInventoryModal 
                    unit={editingUnit} 
                    buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
                    onClose={() => setEditingUnit(null)}
                    onSave={handleSaveUnit}
                />
            )}

            {editingUnit && mode === 'parking' && (
                <ParkingEditModal 
                    unit={editingUnit} 
                    buildingLabel={`Дом ${editingUnit.houseNumber}, ${editingUnit.buildingLabel}`}
                    onClose={() => setEditingUnit(null)}
                    onSave={handleSaveUnit}
                />
            )}
        </div>
    );
}