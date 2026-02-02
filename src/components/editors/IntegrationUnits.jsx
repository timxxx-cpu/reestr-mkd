import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, Send, Loader2, CheckCircle2, AlertTriangle, 
  Home, Car, Briefcase, RefreshCw, Hash, ArrowRight,
  Building2, FileText, School, Filter
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Button, SectionTitle, Badge, useReadOnly, TabButton } from '../ui/UIKit';
import { useToast } from '../../context/ToastContext';
import { getBlocksList } from '../../lib/utils';

// Статусы интеграции
const SYNC_STATUS = {
    IDLE: 'IDLE',
    SENDING: 'SENDING',
    WAITING: 'WAITING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
};

const getTypeConfig = (type) => {
    switch(type) {
        case 'flat': return { label: 'Квартира', icon: Home, color: 'text-blue-600 bg-blue-50 border-blue-200' };
        case 'duplex_up': 
        case 'duplex_down': return { label: 'Дуплекс', icon: Home, color: 'text-purple-600 bg-purple-50 border-purple-200' };
        case 'office': return { label: 'Офис', icon: Briefcase, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
        case 'office_inventory': return { label: 'Нежилое (Инв.)', icon: FileText, color: 'text-teal-600 bg-teal-50 border-teal-200' };
        case 'non_res_block': return { label: 'Нежилой блок', icon: Building2, color: 'text-amber-600 bg-amber-50 border-amber-200' };
        case 'infrastructure': return { label: 'Инфраструктура', icon: School, color: 'text-orange-600 bg-orange-50 border-orange-200' };
        case 'parking_place': return { label: 'Машиноместо', icon: Car, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
        default: return { label: type, icon: FileText, color: 'text-slate-600 bg-slate-50 border-slate-200' };
    }
};

export default function IntegrationUnits() {
    const { 
        composition, flatMatrix, setFlatMatrix, 
        parkingPlaces, setParkingPlaces,
        entrancesData, floorData,
        applicationInfo, setApplicationInfo, saveData, complexInfo 
    } = useProject();
    
    const isReadOnly = useReadOnly();
    const toast = useToast();

    const [status, setStatus] = useState(applicationInfo?.integration?.unitsStatus || SYNC_STATUS.IDLE);
    const [activeTab, setActiveTab] = useState('living'); 

    // --- 1. СБОР ВСЕХ ОБЪЕКТОВ ---
    const allObjects = useMemo(() => {
        const list = [];
        composition.forEach(building => {
            const blocks = getBlocksList(building);

            // А. Квартиры и Явные офисы (из FlatMatrix)
            Object.keys(flatMatrix).forEach(key => {
                if (!key.startsWith(building.id)) return;
                const unit = flatMatrix[key];
                if (!unit || !unit.num) return; 

                list.push({
                    id: key,
                    category: ['flat', 'duplex_up', 'duplex_down'].includes(unit.type) ? 'living' : 'nonres',
                    type: unit.type,
                    number: unit.num,
                    area: unit.area,
                    buildingLabel: building.label,
                    cadastreNumber: unit.cadastreNumber || null,
                    isVirtual: false
                });
            });

            // Б. Виртуальные нежилые
            const resBlocks = blocks.filter(b => b.type === 'Ж');
            resBlocks.forEach(block => {
                Object.keys(entrancesData).forEach(entKey => {
                    if (!entKey.startsWith(block.fullId)) return;
                    const data = entrancesData[entKey];
                    const unitsCount = parseInt(data.units || 0);
                    if (unitsCount > 0) {
                        for(let i = 1; i <= unitsCount; i++) {
                            const virtualId = `${entKey}_unit_${i}`;
                            if (!list.find(item => item.id === virtualId)) {
                                list.push({
                                    id: virtualId,
                                    category: 'nonres',
                                    type: 'office_inventory',
                                    number: `НП-${i}`,
                                    area: '0', 
                                    buildingLabel: building.label,
                                    cadastreNumber: null,
                                    isVirtual: true,
                                    // Доп поля для сохранения
                                    buildingId: building.id,
                                    blockId: block.id
                                });
                            }
                        }
                    }
                });
            });

            const nonResBlocks = blocks.filter(b => b.type === 'Н');
            nonResBlocks.forEach(block => {
                const virtualId = `${building.id}_${block.id}_whole`;
                if (!list.find(item => item.id === virtualId)) {
                    let totalArea = 0;
                    Object.entries(floorData).forEach(([k, v]) => {
                        if (k.startsWith(`${building.id}_${block.id}`)) totalArea += (parseFloat(v.areaProj) || 0);
                    });
                    list.push({
                        id: virtualId,
                        category: 'nonres',
                        type: 'non_res_block',
                        number: block.tabLabel,
                        area: totalArea.toFixed(2),
                        buildingLabel: building.label,
                        cadastreNumber: null,
                        isVirtual: true,
                        buildingId: building.id,
                        blockId: block.id
                    });
                }
            });

            if (building.category === 'infrastructure') {
                const virtualId = building.id;
                if (!list.find(item => item.id === virtualId)) {
                    let infraArea = 0;
                    Object.entries(floorData).forEach(([k, v]) => {
                        if (k.startsWith(`${building.id}_main`)) infraArea += (parseFloat(v.areaProj) || 0);
                    });
                    list.push({
                        id: virtualId,
                        category: 'nonres',
                        type: 'infrastructure',
                        number: building.houseNumber,
                        area: infraArea.toFixed(2),
                        buildingLabel: building.label,
                        cadastreNumber: building.cadastreNumber || null,
                        isVirtual: true,
                        buildingId: building.id
                    });
                }
            }

            // В. Паркинг
            Object.keys(parkingPlaces).forEach(key => {
                if (!key.startsWith(building.id) || !key.includes('_place')) return;
                const place = parkingPlaces[key];
                
                list.push({
                    id: key,
                    category: 'parking',
                    type: 'parking_place',
                    number: place.number,
                    area: place.area,
                    buildingLabel: building.label,
                    cadastreNumber: place.cadastreNumber || null,
                    isVirtual: false
                });
            });
        });

        return list;
    }, [composition, flatMatrix, entrancesData, floorData, parkingPlaces]);

    const stats = useMemo(() => {
        const s = { living: { total: 0, ready: 0 }, nonres: { total: 0, ready: 0 }, parking: { total: 0, ready: 0 } };
        allObjects.forEach(obj => {
            if (s[obj.category]) {
                s[obj.category].total++;
                if (obj.cadastreNumber) s[obj.category].ready++;
            }
        });
        return s;
    }, [allObjects]);

    const filteredList = useMemo(() => allObjects.filter(o => o.category === activeTab), [allObjects, activeTab]);

    useEffect(() => {
        if (applicationInfo?.integration?.unitsStatus !== status) {
            const newIntegration = { ...(applicationInfo?.integration || {}), unitsStatus: status };
            setApplicationInfo(prev => ({ ...prev, integration: newIntegration }));
            saveData({ applicationInfo: { ...applicationInfo, integration: newIntegration } });
        }
    }, [status]);

    const handleSendToUzkad = async () => {
        if (isReadOnly) return;
        setStatus(SYNC_STATUS.SENDING);
        setTimeout(() => {
            setStatus(SYNC_STATUS.WAITING);
            toast.info("Реестр отправлен. Ожидание присвоения номеров...");
        }, 2000);
    };

    const handleSimulateResponse = () => {
        if (isReadOnly) return; 
        const newFlatMatrix = { ...flatMatrix };
        const newParkingPlaces = { ...parkingPlaces };

        let processedCount = 0;

        allObjects.forEach(obj => {
            if (obj.cadastreNumber) return; 

            const uniquePart = Math.floor(100000 + Math.random() * 900000);
            const generatedCadastre = `11:05:04:02:0077:${obj.category === 'parking' ? 'P:' : ''}${uniquePart}`;

            if (obj.category === 'parking') {
                if (newParkingPlaces[obj.id]) {
                    newParkingPlaces[obj.id] = { ...newParkingPlaces[obj.id], cadastreNumber: generatedCadastre };
                    processedCount++;
                }
            } else {
                if (!obj.isVirtual) {
                    // Существующий юнит
                    if (newFlatMatrix[obj.id]) {
                        newFlatMatrix[obj.id] = { ...newFlatMatrix[obj.id], cadastreNumber: generatedCadastre };
                        processedCount++;
                    }
                } else {
                    // Виртуальный юнит -> превращаем в реальный с UUID
                    const newId = crypto.randomUUID(); // Генерируем UUID
                    // ВАЖНО: Мы сохраняем объект по СТАРОМУ ключу (obj.id - который был virtualId), 
                    // чтобы React-компоненты могли его найти, НО внутри объекта будет лежать настоящий UUID.
                    // Либо мы сохраняем по UUID ключу, но тогда надо чистить старые ссылки. 
                    // Для совместимости с текущим FlatMatrixEditor, который работает на строковых ключах, 
                    // сохраним ключ как есть, но добавим поле id.
                    
                    newFlatMatrix[obj.id] = {
                        id: newId, // UUID
                        num: obj.number,
                        type: obj.type,
                        area: obj.area,
                        cadastreNumber: generatedCadastre,
                        buildingId: obj.buildingId,
                        blockId: obj.blockId
                    };
                    processedCount++;
                }
            }
        });

        setFlatMatrix(newFlatMatrix);
        setParkingPlaces(newParkingPlaces);
        setStatus(SYNC_STATUS.COMPLETED);
        
        saveData({ 
            flatMatrix: newFlatMatrix, 
            parkingPlaces: newParkingPlaces 
        }, true);
        
        toast.success(`Получено ${processedCount} новых кадастровых номеров!`);
    };

    const handleReset = () => {
        if (isReadOnly) return;
        if(!confirm("Сбросить статус интеграции?")) return;
        setStatus(SYNC_STATUS.IDLE);
    };

    return (
        <div className="w-full pb-24 animate-in fade-in duration-500 space-y-6">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Регистрация помещений</h1>
                        <p className="text-slate-500 text-sm">Отправка реестров в УЗКАД и получение кадастровых номеров</p>
                    </div>
                </div>
                
                {/* Status Badge */}
                <div className={`px-4 py-2 rounded-xl text-sm font-bold border flex items-center gap-2 shadow-sm ${
                    status === SYNC_STATUS.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    status === SYNC_STATUS.WAITING ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                    'bg-white text-slate-600 border-slate-200'
                }`}>
                    <RefreshCw size={16} className={status === SYNC_STATUS.SENDING ? 'animate-spin' : ''}/>
                    {status === SYNC_STATUS.IDLE && 'Готов к отправке'}
                    {status === SYNC_STATUS.SENDING && 'Отправка...'}
                    {status === SYNC_STATUS.WAITING && 'Ожидание ответа УЗКАД'}
                    {status === SYNC_STATUS.COMPLETED && 'Все данные получены'}
                </div>
            </div>

            {/* --- ACTION CARD --- */}
            <Card className="p-6 bg-slate-50/50 border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="flex -space-x-3">
                            <div className="w-12 h-12 rounded-full bg-blue-100 border-4 border-white flex items-center justify-center text-blue-600 z-30"><Home size={20}/></div>
                            <div className="w-12 h-12 rounded-full bg-emerald-100 border-4 border-white flex items-center justify-center text-emerald-600 z-20"><Briefcase size={20}/></div>
                            <div className="w-12 h-12 rounded-full bg-indigo-100 border-4 border-white flex items-center justify-center text-indigo-600 z-10"><Car size={20}/></div>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-700">Единый пакет данных</div>
                            <div className="text-xs text-slate-500 mt-1">
                                Всего объектов: <span className="font-bold text-slate-900">{allObjects.length}</span> 
                                <span className="mx-2">•</span>
                                Обработано: <span className="font-bold text-emerald-600">{allObjects.filter(o=>o.cadastreNumber).length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        {status === SYNC_STATUS.IDLE && (
                            <Button 
                                onClick={handleSendToUzkad} 
                                disabled={isReadOnly || allObjects.length === 0}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 w-full md:w-auto"
                            >
                                <Send size={16} className="mr-2"/> Отправить реестр
                            </Button>
                        )}
                        {status === SYNC_STATUS.WAITING && (
                            <Button 
                                onClick={handleSimulateResponse} 
                                disabled={isReadOnly}
                                variant="secondary" 
                                className="border-dashed border-slate-300 w-full md:w-auto"
                            >
                                <RefreshCw size={16} className="mr-2"/> Получить ответ (Эмуляция)
                            </Button>
                        )}
                        {status !== SYNC_STATUS.IDLE && !isReadOnly && (
                            <button onClick={handleReset} className="px-4 text-xs font-bold text-slate-400 hover:text-red-500">Сброс</button>
                        )}
                    </div>
                </div>
            </Card>

            {/* --- TABS & TABLE --- */}
            <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-max">
                    <TabButton active={activeTab==='living'} onClick={()=>setActiveTab('living')}>
                        <Home size={16} className="mr-2 opacity-70"/> Квартиры <Badge className="ml-2 bg-white text-slate-700 shadow-sm">{stats.living.total}</Badge>
                    </TabButton>
                    <TabButton active={activeTab==='nonres'} onClick={()=>setActiveTab('nonres')}>
                        <Briefcase size={16} className="mr-2 opacity-70"/> Нежилые <Badge className="ml-2 bg-white text-slate-700 shadow-sm">{stats.nonres.total}</Badge>
                    </TabButton>
                    <TabButton active={activeTab==='parking'} onClick={()=>setActiveTab('parking')}>
                        <Car size={16} className="mr-2 opacity-70"/> Паркинг <Badge className="ml-2 bg-white text-slate-700 shadow-sm">{stats.parking.total}</Badge>
                    </TabButton>
                </div>

                <Card className="overflow-hidden border border-slate-200 shadow-md bg-white min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 w-12 text-center">#</th>
                                    <th className="px-6 py-4">Номер / Имя</th>
                                    <th className="px-6 py-4">Тип</th>
                                    <th className="px-6 py-4">Здание</th>
                                    <th className="px-6 py-4 text-right">Площадь</th>
                                    <th className="px-6 py-4">Кадастровый номер</th>
                                    <th className="px-6 py-4 text-center">Статус</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredList.length === 0 ? (
                                    <tr><td colSpan={7} className="p-12 text-center text-slate-400">Нет объектов в этой категории</td></tr>
                                ) : (
                                    filteredList.map((item, idx) => {
                                        const typeConf = getTypeConfig(item.type);
                                        const TypeIcon = typeConf.icon;
                                        const hasCadastre = !!item.cadastreNumber;

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 text-center text-slate-400 text-xs">{idx+1}</td>
                                                <td className="px-6 py-4 font-black text-slate-700">{item.number}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase border ${typeConf.color}`}>
                                                        <TypeIcon size={12}/> {typeConf.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-500">{item.buildingLabel}</td>
                                                <td className="px-6 py-4 text-right font-mono text-slate-600">
                                                    {item.area ? `${parseFloat(item.area).toFixed(2)} м²` : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {hasCadastre ? (
                                                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                                            {item.cadastreNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {hasCadastre ? (
                                                        <CheckCircle2 size={18} className="text-emerald-500 mx-auto"/>
                                                    ) : (
                                                        <div className={`w-2 h-2 rounded-full mx-auto ${status === SYNC_STATUS.WAITING ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'}`}></div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}