import React from 'react';
import { 
  Globe, Send, Loader2, CheckCircle2, 
  Building2, Server, RefreshCw, Hash, MapPin, Layers, Box
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useDirectBuildings } from '../../hooks/api/useDirectBuildings';
import { useDirectIntegration } from '../../hooks/api/useDirectIntegration';
import { Card, Button, SectionTitle, Badge, useReadOnly } from '../ui/UIKit';
import { useToast } from '../../context/ToastContext';

const SYNC_STATUS = {
    IDLE: 'IDLE',
    SENDING: 'SENDING',
    WAITING: 'WAITING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
};

const PARKING_TYPE_LABELS = {
    underground: "Подземный",
    ground: "Наземный"
};

const TYPE_NAMES = {
    residential: "Жилой дом", 
    residential_multiblock: "Жилой комплекс", 
    parking_separate: "Паркинг", 
    infrastructure: "Инфраструктура" 
};

export default function IntegrationBuildings() {
    const { projectId } = useProject();
    const isReadOnly = useReadOnly();
    const toast = useToast();

    // Data from DB
    const { buildings } = useDirectBuildings(projectId);
    const { integrationStatus, setIntegrationStatus, setBuildingCadastre } = useDirectIntegration(projectId);

    const status = integrationStatus.buildingsStatus || SYNC_STATUS.IDLE;

    const updateStatus = (newStatus) => {
        setIntegrationStatus({ field: 'buildingsStatus', status: newStatus });
    };

    const handleSendToUzkad = async () => {
        if (isReadOnly) return;
        updateStatus(SYNC_STATUS.SENDING);
        setTimeout(() => {
            updateStatus(SYNC_STATUS.WAITING);
            toast.info("Данные отправлены. Ожидание ответа от УЗКАД...");
        }, 1500);
    };

    const handleSimulateResponse = async () => {
        if (isReadOnly) return;
        
        // Эмуляция получения кадастровых номеров
        for (const b of buildings) {
            // [FIX] Доступ к полю с учетом того, что оно может быть не замаплено в camelCase
            // @ts-ignore
            const currentCadastre = b.cadastreNumber || b.cadastre_number;
            
            if (!currentCadastre) {
                const regionCode = "11:05:04:02"; 
                const uniquePart = Math.floor(1000 + Math.random() * 9000);
                await setBuildingCadastre({ id: b.id, cadastre: `${regionCode}:${uniquePart}` });
            }
        }

        updateStatus(SYNC_STATUS.COMPLETED);
        toast.success("Кадастровые номера получены!");
    };

    const handleReset = () => {
        if (isReadOnly) return;
        if(!confirm("Сбросить статус интеграции?")) return;
        updateStatus(SYNC_STATUS.IDLE);
    };

    return (
        <div className="w-full pb-20 animate-in fade-in duration-500 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200">
                        <Globe size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Регистрация зданий (УЗКАД)</h1>
                        <p className="text-slate-500 text-sm">Первичная постановка зданий и сооружений на кадастровый учет</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs px-3 py-1">
                        Всего объектов: {buildings.length}
                    </Badge>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 ${
                        status === SYNC_STATUS.COMPLETED ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        status === SYNC_STATUS.WAITING ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                        <Server size={14}/>
                        {status === SYNC_STATUS.IDLE && 'Готов к отправке'}
                        {status === SYNC_STATUS.SENDING && 'Отправка...'}
                        {status === SYNC_STATUS.WAITING && 'Ожидание ответа'}
                        {status === SYNC_STATUS.COMPLETED && 'Синхронизировано'}
                    </div>
                </div>
            </div>

            <Card className="p-6 border-l-4 border-l-blue-500 shadow-sm bg-slate-50/50">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 ${
                            status === SYNC_STATUS.COMPLETED ? 'bg-emerald-100 border-emerald-200 text-emerald-600' :
                            status === SYNC_STATUS.WAITING ? 'bg-amber-100 border-amber-200 text-amber-600 animate-pulse' :
                            'bg-white border-slate-200 text-slate-400'
                        }`}>
                            {status === SYNC_STATUS.COMPLETED ? <CheckCircle2 size={24}/> : 
                             status === SYNC_STATUS.WAITING ? <Loader2 size={24} className="animate-spin"/> :
                             <Globe size={24}/>}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">
                                {status === SYNC_STATUS.IDLE && 'Пакет данных сформирован'}
                                {status === SYNC_STATUS.WAITING && 'Запрос обрабатывается в УЗКАД'}
                                {status === SYNC_STATUS.COMPLETED && 'Кадастровые номера успешно получены'}
                            </h3>
                            <p className="text-sm text-slate-500">
                                {status === SYNC_STATUS.IDLE && 'Проверьте список зданий ниже и нажмите "Отправить" для регистрации.'}
                                {status === SYNC_STATUS.WAITING && 'Пожалуйста, ожидайте ответа от внешней системы.'}
                                {status === SYNC_STATUS.COMPLETED && 'Все здания зарегистрированы. Можно переходить к следующему этапу.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {status === SYNC_STATUS.IDLE && (
                            <Button 
                                onClick={handleSendToUzkad} 
                                disabled={isReadOnly || buildings.length === 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 px-8 h-12 text-sm"
                            >
                                <Send size={18} className="mr-2"/> Отправить в УЗКАД
                            </Button>
                        )}

                        {status === SYNC_STATUS.WAITING && (
                            <Button 
                                onClick={handleSimulateResponse} 
                                disabled={isReadOnly}
                                variant="secondary"
                                className="border-dashed border-slate-300 text-slate-500 hover:text-slate-700 h-12"
                            >
                                <RefreshCw size={16} className="mr-2"/> Получить ответ (Эмуляция)
                            </Button>
                        )}

                        {status !== SYNC_STATUS.IDLE && !isReadOnly && (
                             <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500 underline decoration-dashed px-2">
                                 Сброс
                             </button>
                        )}
                    </div>
                </div>
            </Card>

            <div className="space-y-3">
                <SectionTitle icon={Building2} className="px-1">Реестр зданий для передачи</SectionTitle>
                
                <Card className="overflow-hidden border border-slate-200 shadow-md bg-white">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 w-12 text-center">#</th>
                                <th className="px-6 py-4 w-1/4">Объект</th>
                                <th className="px-6 py-4 w-1/5">Тип / Вид</th>
                                <th className="px-6 py-4 w-1/4">Конфигурация</th>
                                <th className="px-6 py-4 text-right">Кадастровый номер</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {buildings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-400">Нет зданий для передачи</td>
                                </tr>
                            ) : (
                                buildings.map((item, idx) => {
                                    // [FIX] Доступ к полю с учетом возможных вариантов
                                    // @ts-ignore
                                    const cadastreNum = item.cadastreNumber || item.cadastre_number; 
                                    const hasCadastre = !!cadastreNum;
                                    
                                    let typeLabel = TYPE_NAMES[item.category] || item.category;
                                    let subTypeLabel = null;

                                    if (item.category === 'parking_separate') {
                                        subTypeLabel = PARKING_TYPE_LABELS[item.parkingType] || item.parkingType;
                                    } else if (item.category === 'infrastructure') {
                                        subTypeLabel = item.infraType;
                                    }

                                    return (
                                        <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                                            
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 text-sm mb-0.5">{item.label}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                                        Дом {item.houseNumber}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700">{typeLabel}</span>
                                                    {subTypeLabel && <span className="text-xs text-slate-400">{subTypeLabel}</span>}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {(item.resBlocks > 0 || item.nonResBlocks > 0) ? (
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <Layers size={14} className="text-slate-400"/>
                                                            <span className="font-medium">
                                                                {item.resBlocks} жил. / {item.nonResBlocks} нежил.
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                                            <Box size={14}/>
                                                            <span>Моноблок</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                {hasCadastre ? (
                                                    <div className="inline-flex items-center gap-2 font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm">
                                                        <CheckCircle2 size={14} className="text-emerald-500"/>
                                                        {cadastreNum}
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                                        <Hash size={14} className="opacity-50"/>
                                                        <span>Ожидание...</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </Card>
            </div>
        </div>
    );
}