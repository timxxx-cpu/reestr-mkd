import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, MapPin, FileText, Clock, 
  Loader2, Save, Wand2, Building, 
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext'; 
import { useDirectProjectInfo } from '../../hooks/api/useDirectProjectInfo';
import { Card, SectionTitle, Label, Input, Button, useReadOnly } from '../ui/UIKit';
import { calculateProgress } from '../../lib/utils';
import { useCatalog } from '../../hooks/useCatalogs';

const STATUS_CONFIG = {
    'Проектный': { color: 'bg-purple-500', text: 'Проектирование', icon: FileText },
    'Строящийся': { color: 'bg-blue-500', text: 'Стройка идет', icon: Building },
    'Готовый к вводу': { color: 'bg-orange-500', text: 'Сдача ГК', icon: AlertCircle },
    'Введенный': { color: 'bg-emerald-500', text: 'Объект сдан', icon: CheckCircle2 },
};

export default function PassportEditor() {
    const { projectId } = useProject(); 
    const isReadOnly = useReadOnly();
    
    // Хук для чтения/записи данных проекта
    const { 
        complexInfo, cadastre, isLoading,
        updateProjectInfo, isSaving 
    } = useDirectProjectInfo(projectId);

    // Локальный стейт формы (инициализируем пустыми строками)
    const [localInfo, setLocalInfo] = useState({
        name: '', status: 'Проектный', region: '', district: '', street: '', landmark: '',
        dateStartProject: '', dateEndProject: '', dateStartFact: '', dateEndFact: ''
    });
    const [localCadastre, setLocalCadastre] = useState({
        number: '', address: '', area: ''
    });
    
    // Флаг, чтобы загрузить данные только один раз при входе
    const dataLoadedRef = useRef(false);

    // 1. Инициализация данными с сервера
    useEffect(() => {
        // Загружаем данные только если они пришли (complexInfo не пуст) и мы еще не загружали
        if (!isLoading && complexInfo && Object.keys(complexInfo).length > 0 && !dataLoadedRef.current) {
            
            setLocalInfo(prev => ({ 
                ...prev, 
                ...complexInfo,
                // Явно приводим к строке, чтобы избежать ошибок с null в инпутах
                name: complexInfo.name || '',
                status: complexInfo.status || 'Проектный',
                region: complexInfo.region || '',
                district: complexInfo.district || '',
                street: complexInfo.street || '',
                landmark: complexInfo.landmark || '',
                dateStartProject: complexInfo.dateStartProject || '',
                dateEndProject: complexInfo.dateEndProject || '',
                dateStartFact: complexInfo.dateStartFact || '',
                dateEndFact: complexInfo.dateEndFact || ''
            }));
            
            if (cadastre) {
                setLocalCadastre(prev => ({ 
                    ...prev, 
                    ...cadastre,
                    number: cadastre.number || '',
                    address: cadastre.address || '',
                    area: cadastre.area || ''
                }));
            }
            
            dataLoadedRef.current = true;
        }
    }, [complexInfo, cadastre, isLoading]);

    // 2. Авто-сохранение (debounce 1.5 сек)
    useEffect(() => {
        // Не сохраняем, пока данные не загрузились первый раз или если режим чтения
        if (!dataLoadedRef.current || isReadOnly) return;

        const timer = setTimeout(() => {
            updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
        }, 1500);
        return () => clearTimeout(timer);
    }, [localInfo, localCadastre, updateProjectInfo, isReadOnly]);

    const handleInfoChange = (field, value) => setLocalInfo(prev => ({ ...prev, [field]: value }));
    const handleCadastreChange = (field, value) => setLocalCadastre(prev => ({ ...prev, [field]: value }));
    
    // 3. Ручное сохранение
    const handleManualSave = async () => {
        await updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
    };

    // Демо-данные (для быстрого теста)
    const autoFill = () => {
        if (isReadOnly) return;
        setLocalInfo(prev => ({
            ...prev,
            status: 'Строящийся', 
            region: 'Ташкент', district: 'Мирзо-Улугбекский',
            dateStartProject: '2024-01-01', dateEndProject: '2026-12-31'
        }));
        setLocalCadastre(prev => ({ ...prev, number: '11:05:04:02:0099', area: '2.5' }));
    };

    const { options: projectStatusOptions } = useCatalog('dict_project_statuses', Object.keys(STATUS_CONFIG));
    const StatusIcon = STATUS_CONFIG[localInfo.status]?.icon || LayoutDashboard;
    const progress = calculateProgress(localInfo.dateStartProject, localInfo.dateEndProject);

    if (isLoading && !dataLoadedRef.current) {
        return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>;
    }

    return (
        <div className="w-full px-6 pb-20 animate-in fade-in duration-500 space-y-6">
            
            {/* Хедер (Карточка проекта) */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900/50 z-0"></div>
                <div className="relative z-10 p-8 md:p-10">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                <Building size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                                    {localInfo.name || "Без названия"}
                                </h1>
                                <div className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                    <span className="flex items-center gap-1"><MapPin size={14}/> {localInfo.street || "Адрес не указан"}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                             <Button 
                                onClick={handleManualSave} 
                                disabled={isReadOnly || isSaving}
                                className="h-9 text-xs bg-white/10 hover:bg-white/20 border-0"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin mr-2"/> : <Save size={14} className="mr-2"/>}
                                Сохранить
                            </Button>

                            <Button variant="secondary" onClick={autoFill} disabled={isReadOnly} className="bg-white/10 border-white/10 text-white text-xs h-9">
                                <Wand2 size={14}/> Демо
                            </Button>
                        </div>
                    </div>
                    
                    {/* Прогресс бар */}
                    <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/5 flex items-center gap-6">
                        <div className="flex-1">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                <span>Прогресс (по срокам)</span> <span className="text-white">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-1000" style={{width: `${progress}%`}} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 min-w-[180px]">
                            <StatusIcon size={20} className="text-white"/>
                            <select 
                                value={localInfo.status || 'Проектный'} 
                                onChange={e => handleInfoChange('status', e.target.value)}
                                className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
                                disabled={isReadOnly}
                            >
                                {projectStatusOptions.map(s => <option key={s.code} value={s.label} className="text-slate-900">{s.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Основная форма */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 shadow-sm">
                        <SectionTitle icon={MapPin}>Основные данные</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="space-y-4">
                                <div>
                                    <Label>Наименование</Label>
                                    <Input 
                                        value={localInfo.name} 
                                        onChange={e => handleInfoChange('name', e.target.value)} 
                                        placeholder="Название ЖК" 
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div>
                                    <Label>Кадастровый номер</Label>
                                    <Input 
                                        value={localCadastre.number} 
                                        onChange={e => handleCadastreChange('number', e.target.value)} 
                                        placeholder="00:00:..."
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div>
                                    <Label>Адрес</Label>
                                    <Input 
                                        value={localInfo.street} 
                                        onChange={e => handleInfoChange('street', e.target.value)} 
                                        placeholder="Улица, дом..."
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Label>Регион</Label>
                                    <Input value={localInfo.region} onChange={e => handleInfoChange('region', e.target.value)} disabled={isReadOnly} />
                                </div>
                                <div>
                                    <Label>Район</Label>
                                    <Input value={localInfo.district} onChange={e => handleInfoChange('district', e.target.value)} disabled={isReadOnly} />
                                </div>
                                <div>
                                    <Label>Ориентир</Label>
                                    <Input value={localInfo.landmark} onChange={e => handleInfoChange('landmark', e.target.value)} disabled={isReadOnly} />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="p-6 shadow-sm">
                        <SectionTitle icon={Clock}>График реализации</SectionTitle>
                        <div className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Начало (План)</Label>
                                    <Input type="date" value={localInfo.dateStartProject || ''} onChange={e => handleInfoChange('dateStartProject', e.target.value)} disabled={isReadOnly} className="text-xs"/>
                                </div>
                                <div>
                                    <Label>Окончание (План)</Label>
                                    <Input type="date" value={localInfo.dateEndProject || ''} onChange={e => handleInfoChange('dateEndProject', e.target.value)} disabled={isReadOnly} className="text-xs"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                                <div>
                                    <Label className="text-slate-400">Начало (Факт)</Label>
                                    <Input type="date" value={localInfo.dateStartFact || ''} onChange={e => handleInfoChange('dateStartFact', e.target.value)} disabled={isReadOnly} className="text-xs bg-slate-50"/>
                                </div>
                                <div>
                                    <Label className="text-slate-400">Окончание (Факт)</Label>
                                    <Input type="date" value={localInfo.dateEndFact || ''} onChange={e => handleInfoChange('dateEndFact', e.target.value)} disabled={isReadOnly} className="text-xs bg-slate-50"/>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}