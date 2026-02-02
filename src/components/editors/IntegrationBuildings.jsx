import React, { useState } from 'react';
import { 
  Globe, Send, Loader2, CheckCircle2, 
  Building2, Server, RefreshCw, Hash, MapPin, Layers, Box
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Button, SectionTitle, Badge, useReadOnly } from '../ui/UIKit';
import { useToast } from '../../context/ToastContext';

// Статусы интеграции
const SYNC_STATUS = {
    IDLE: 'IDLE',
    SENDING: 'SENDING',
    WAITING: 'WAITING', // Ожидание ответа от УЗКАД
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
};

const PARKING_TYPE_LABELS = {
    underground: "Подземный",
    ground: "Наземный"
};

export default function IntegrationBuildings() {
    const { 
        composition, setComposition, 
        applicationInfo, setApplicationInfo, 
        saveData, complexInfo 
    } = useProject();
    
    const isReadOnly = useReadOnly();
    const toast = useToast();

    const [status, setStatus] = useState(applicationInfo?.integration?.buildingsStatus || SYNC_STATUS.IDLE);
    
    const updateStatus = (newStatus) => {
        setStatus(newStatus);
        const newIntegration = { ...(applicationInfo?.integration || {}), buildingsStatus: newStatus };
        setApplicationInfo(prev => ({ ...prev, integration: newIntegration }));
        saveData({ applicationInfo: { ...applicationInfo, integration: newIntegration } });
    };

    const handleSendToUzkad = async () => {
        if (isReadOnly) return;
        updateStatus(SYNC_STATUS.SENDING);
        setTimeout(() => {
            updateStatus(SYNC_STATUS.WAITING);
            toast.info("Данные отправлены. Ожидание ответа от УЗКАД...");
        }, 2000);
    };

    const handleSimulateResponse = () => {
        if (isReadOnly) return;
        
        // Обновляем composition, сохраняя целостность объектов
        const updatedComposition = composition.map((building) => {
            if (building.cadastreNumber) return building;
            const regionCode = "11:05:04:02"; 
            const uniquePart = Math.floor(1000 + Math.random() * 9000);
            return {
                ...building,
                // ID уже есть (UUID), добавляем внешние идентификаторы
                cadastreNumber: `${regionCode}:${uniquePart}`,
                uzkadId: `UZ-${crypto.randomUUID().slice(0,8).toUpperCase()}`
            };
        });

        setComposition(updatedComposition);
        updateStatus(SYNC_STATUS.COMPLETED);
        
        // Сохраняем обновленный список зданий
        saveData({ composition: updatedComposition }, true);
        
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
                        Всего объектов: {composition.length}
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
                                disabled={isReadOnly || composition.length === 0}
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
                                <th className="px-6 py-4 w-1/4">Адрес</th>
                                <th className="px-6 py-4 w-1/6">Конфигурация</th>
                                <th className="px-6 py-4 text-right">Кадастровый номер</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {composition.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400">Нет зданий для передачи</td>
                                </tr>
                            ) : (
                                composition.map((item, idx) => {
                                    const hasCadastre = !!item.cadastreNumber;
                                    let typeLabel = item.type;
                                    let subTypeLabel = null;

                                    if (item.category === 'parking_separate') {
                                        typeLabel = "Паркинг";
                                        subTypeLabel = PARKING_TYPE_LABELS[item.parkingType] || item.parkingType;
                                    } else if (item.category === 'infrastructure') {
                                        typeLabel = "Инфраструктура";
                                        subTypeLabel = item.infraType;
                                    } else if (item.category === 'residential_multiblock') {
                                        typeLabel = "Многоблочный дом";
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
                                                <div className="flex items-start gap-2 text-xs text-slate-600 max-w-xs">
                                                    <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400"/>
                                                    <span className="line-clamp-2" title={complexInfo?.street}>
                                                        {complexInfo?.street || "Адрес не указан"}
                                                    </span>
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
                                                        {item.cadastreNumber}
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