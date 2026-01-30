import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, Send, Loader2, CheckCircle2, AlertTriangle, 
  Home, Car, Briefcase, RefreshCw, Hash, ArrowRight
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Button, SectionTitle, Badge, useReadOnly } from '../ui/UIKit';
import { useToast } from '../../context/ToastContext';

// Статусы интеграции
const SYNC_STATUS = {
    IDLE: 'IDLE',
    SENDING: 'SENDING',
    WAITING: 'WAITING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
};

export default function IntegrationUnits() {
    const { 
        composition, flatMatrix, setFlatMatrix, 
        parkingPlaces, setParkingPlaces,
        applicationInfo, setApplicationInfo, saveData 
    } = useProject();
    
    const isReadOnly = useReadOnly();
    const toast = useToast();

    // Локальный стейт статуса, синхронизируемый с глобальным
    const [status, setStatus] = useState(applicationInfo?.integration?.unitsStatus || SYNC_STATUS.IDLE);

    // Сбор статистики для отображения
    const stats = useMemo(() => {
        let totalFlats = 0;
        let totalCommercial = 0;
        let totalParking = 0;
        let totalProcessed = 0;

        // Считаем квартиры и коммерцию
        Object.values(flatMatrix).forEach(unit => {
            if (['flat', 'duplex_up', 'duplex_down'].includes(unit.type)) totalFlats++;
            else totalCommercial++;
            
            if (unit.cadastreNumber) totalProcessed++;
        });

        // Считаем паркинг
        Object.keys(parkingPlaces).forEach(key => {
            if (key.includes('_place')) {
                totalParking++;
                if (parkingPlaces[key].cadastreNumber) totalProcessed++;
            }
        });

        return { totalFlats, totalCommercial, totalParking, total: totalFlats + totalCommercial + totalParking, totalProcessed };
    }, [flatMatrix, parkingPlaces]);

    useEffect(() => {
        if (applicationInfo?.integration?.unitsStatus !== status) {
            const newIntegration = { ...(applicationInfo?.integration || {}), unitsStatus: status };
            setApplicationInfo(prev => ({ ...prev, integration: newIntegration }));
            saveData({ applicationInfo: { ...applicationInfo, integration: newIntegration } });
        }
    }, [status]);

    const handleSendToUzkad = async () => {
        setStatus(SYNC_STATUS.SENDING);
        setTimeout(() => {
            setStatus(SYNC_STATUS.WAITING);
            toast.info("Реестр помещений отправлен. Ожидание обработки...");
        }, 2500);
    };

    const handleSimulateResponse = () => {
        // 1. Обновляем Квартиры и Коммерцию
        const newFlatMatrix = { ...flatMatrix };
        Object.keys(newFlatMatrix).forEach(key => {
            if (!newFlatMatrix[key].cadastreNumber) {
                const uniquePart = Math.floor(100000 + Math.random() * 900000);
                newFlatMatrix[key] = {
                    ...newFlatMatrix[key],
                    cadastreNumber: `11:05:04:02:0077:${uniquePart}`
                };
            }
        });

        // 2. Обновляем Паркинги
        const newParkingPlaces = { ...parkingPlaces };
        Object.keys(newParkingPlaces).forEach(key => {
            if (key.includes('_place') && !newParkingPlaces[key].cadastreNumber) {
                const uniquePart = Math.floor(100000 + Math.random() * 900000);
                newParkingPlaces[key] = {
                    ...newParkingPlaces[key],
                    cadastreNumber: `11:05:04:02:0077:P:${uniquePart}`
                };
            }
        });

        setFlatMatrix(newFlatMatrix);
        setParkingPlaces(newParkingPlaces);
        setStatus(SYNC_STATUS.COMPLETED);
        
        // Сохраняем пачкой
        saveData({ 
            flatMatrix: newFlatMatrix, 
            parkingPlaces: newParkingPlaces 
        }, true); // true = показать уведомление
        
        toast.success("Кадастровые номера для помещений получены!");
    };

    const handleReset = () => {
        if(!confirm("Сбросить статус интеграции помещений?")) return;
        setStatus(SYNC_STATUS.IDLE);
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-500 space-y-8">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Регистрация помещений</h1>
                        <p className="text-slate-500 text-sm">Передача реестра квартир, офисов и парковочных мест</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 ${
                        status === SYNC_STATUS.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        status === SYNC_STATUS.WAITING ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                        <RefreshCw size={14}/>
                        {status === SYNC_STATUS.IDLE && 'Ожидание отправки'}
                        {status === SYNC_STATUS.SENDING && 'Формирование пакета...'}
                        {status === SYNC_STATUS.WAITING && 'Присвоение номеров'}
                        {status === SYNC_STATUS.COMPLETED && 'Реестр синхронизирован'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Panel: Status & Actions */}
                <Card className="lg:col-span-1 p-6 h-fit space-y-6">
                    <SectionTitle icon={Database}>Процесс обмена</SectionTitle>
                    
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 border-4 ${
                            status === SYNC_STATUS.SENDING || status === SYNC_STATUS.WAITING ? 'bg-amber-50 border-amber-200 text-amber-600 animate-pulse' :
                            status === SYNC_STATUS.COMPLETED ? 'bg-emerald-50 border-emerald-200 text-emerald-600' :
                            'bg-slate-50 border-slate-100 text-slate-400'
                        }`}>
                            {status === SYNC_STATUS.SENDING ? <Loader2 size={32} className="animate-spin"/> :
                             status === SYNC_STATUS.WAITING ? <Database size={32} className="animate-bounce"/> :
                             status === SYNC_STATUS.COMPLETED ? <CheckCircle2 size={32}/> :
                             <ArrowRight size={32}/>}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {status === SYNC_STATUS.IDLE && 'Пакет сформирован'}
                                {status === SYNC_STATUS.WAITING && 'Обработка реестра'}
                                {status === SYNC_STATUS.COMPLETED && 'Успешно'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 px-4">
                                {status === SYNC_STATUS.IDLE && `Готово к передаче: ${stats.total} объектов недвижимости.`}
                                {status === SYNC_STATUS.WAITING && 'УЗКАД проводит проверку площадей и генерацию кадастровых паспортов.'}
                                {status === SYNC_STATUS.COMPLETED && `Получено ${stats.totalProcessed} кадастровых номеров.`}
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-3">
                        {status === SYNC_STATUS.IDLE && (
                            <Button 
                                onClick={handleSendToUzkad} 
                                disabled={isReadOnly || stats.total === 0}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                            >
                                <Send size={16} className="mr-2"/> Отправить реестр
                            </Button>
                        )}

                        {status === SYNC_STATUS.WAITING && (
                            <div className="space-y-3">
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex gap-2">
                                    <Loader2 size={16} className="animate-spin shrink-0"/>
                                    <span>Массовое присвоение номеров может занять до 24 часов.</span>
                                </div>
                                <Button 
                                    onClick={handleSimulateResponse} 
                                    variant="secondary"
                                    className="w-full border-dashed border-slate-300 text-slate-500 hover:text-slate-700"
                                >
                                    <RefreshCw size={14} className="mr-2"/> Получить ответ (Dev)
                                </Button>
                            </div>
                        )}

                        {status === SYNC_STATUS.COMPLETED && (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 flex gap-2 items-center justify-center">
                                <CheckCircle2 size={16}/>
                                <span className="font-bold">Данные обновлены</span>
                            </div>
                        )}

                        {status !== SYNC_STATUS.IDLE && !isReadOnly && (
                             <button onClick={handleReset} className="text-[10px] text-slate-400 hover:text-red-500 w-full text-center mt-2 underline decoration-dashed">
                                 Сброс (Отладка)
                             </button>
                        )}
                    </div>
                </Card>

                {/* Right Panel: Summary */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                        <SectionTitle icon={Database} className="mb-0">Состав пакета данных</SectionTitle>
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                            Всего объектов: {stats.total}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Home size={20}/></div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{stats.totalFlats}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Квартиры</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><Briefcase size={20}/></div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{stats.totalCommercial}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Нежилые</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-slate-50 text-slate-600 rounded-lg"><Car size={20}/></div>
                            <div>
                                <div className="text-2xl font-black text-slate-800">{stats.totalParking}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Машиноместа</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mt-4">
                        <h4 className="text-sm font-bold text-slate-700 mb-3">Пример передаваемых данных (JSON)</h4>
                        <div className="bg-slate-900 rounded-xl p-4 overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                            <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto custom-scrollbar">
{`{
  "request_id": "REQ-${Date.now()}",
  "project_id": "PRJ-10293",
  "objects": [
    {
      "type": "FLAT",
      "number": "14",
      "area": "74.50",
      "rooms": 3,
      "building_ref": "b_1700..."
    },
    {
      "type": "PARKING",
      "number": "P-12",
      "area": "13.25",
      "level": "-1",
      "building_ref": "b_1700..."
    },
    ... (еще ${stats.total - 2} объектов)
  ]
}`}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}