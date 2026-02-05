import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, MapPin, Briefcase, FileText, Clock, 
  Search, Plus, Trash2, Loader2, Save, Wand2, Building, 
  CheckCircle2, AlertCircle, FileBadge, Calendar, ArrowRight,
  Activity
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext'; // Контекст WorkFlow
import { useDirectProjectInfo } from '../../hooks/api/useDirectProjectInfo';
import { Card, SectionTitle, Label, Input, Button, useReadOnly, DebouncedInput } from '../ui/UIKit';
import { calculateProgress } from '../../lib/utils';
import { ComplexInfoSchema } from '../../lib/schemas';
import { useValidation } from '../../hooks/useValidation';
import { useCatalog } from '../../hooks/useCatalogs';

// ... (функция getDuration и STATUS_CONFIG остаются без изменений)
function getDuration(start, end) {
    if (!start || !end) return null;
    const d1 = new Date(start);
    const d2 = new Date(end);
    const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    return months > 0 ? `${months} мес.` : null;
}

const STATUS_CONFIG = {
    'Проектный': { color: 'bg-purple-500', text: 'Проектирование', icon: FileText },
    'Строящийся': { color: 'bg-blue-500', text: 'Стройка идет', icon: Building },
    'Готовый к вводу': { color: 'bg-orange-500', text: 'Сдача ГК', icon: AlertCircle },
    'Введенный': { color: 'bg-emerald-500', text: 'Объект сдан', icon: CheckCircle2 },
};

export default function PassportEditor() {
    // Получаем setProjectId из контекста, чтобы установить ID после создания
    const { projectId, setProjectId } = useProject(); 
    const isReadOnly = useReadOnly();
    
    const { 
        complexInfo, cadastre, participants, documents, isLoading,
        createProject, updateProjectInfo, updateParticipant, upsertDocument, deleteDocument, isSaving 
    } = useDirectProjectInfo(projectId);

    // Локальный стейт
    const [localInfo, setLocalInfo] = useState({
        name: '', status: 'Проектный', region: '', district: '', street: '', landmark: '',
        dateStartProject: '', dateEndProject: '', dateStartFact: '', dateEndFact: ''
    });
    const [localCadastre, setLocalCadastre] = useState({
        number: '', address: '', area: ''
    });
    
    const initialized = useRef(false);

    // Загрузка данных при наличии ID
    useEffect(() => {
        if (!isLoading && projectId && complexInfo && !initialized.current) {
            setLocalInfo(prev => ({ ...prev, ...complexInfo }));
            setLocalCadastre(prev => ({ ...prev, ...cadastre }));
            initialized.current = true;
        }
    }, [complexInfo, cadastre, isLoading, projectId]);

    // --- ГЛАВНОЕ ИЗМЕНЕНИЕ: ЛОГИКА СОХРАНЕНИЯ ---
    
    // 1. Авто-сохранение (Только если проект уже создан)
    useEffect(() => {
        if (!initialized.current || !projectId) return;

        const timer = setTimeout(() => {
            updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
        }, 2000);
        return () => clearTimeout(timer);
    }, [localInfo, localCadastre, projectId]);

    // 2. Ручное сохранение / Создание
    const handleManualSave = async () => {
        if (!projectId) {
            // РЕЖИМ СОЗДАНИЯ (Первый шаг WorkFlow)
            try {
                const newProject = await createProject({
                    name: localInfo.name || 'Новый проект',
                    street: localInfo.street
                });
                
                if (newProject && newProject.id) {
                    // Записываем ID в контекст WorkFlow -> приложение понимает, что проект создан
                    setProjectId(newProject.id); 
                    
                    // Сразу сохраняем остальные данные, которые могли быть введены
                    // (так как createProject сохраняет только имя и адрес)
                    // Но это сработает уже через useEffect, так как projectId изменится
                }
            } catch (e) {
                console.error("Ошибка создания:", e);
            }
        } else {
            // РЕЖИМ ОБНОВЛЕНИЯ
            updateProjectInfo({ info: localInfo, cadastreData: localCadastre });
        }
    };

    // ... (Обработчики handleInfoChange и прочие остаются такими же)
    const handleInfoChange = (field, value) => setLocalInfo(prev => ({ ...prev, [field]: value }));
    const handleCadastreChange = (field, value) => setLocalCadastre(prev => ({ ...prev, [field]: value }));
    
    const handleParticipantChange = (role, field, value) => {
        if (!projectId) return; // Нельзя добавлять участников, пока проект не создан
        const current = participants[role] || {};
        updateParticipant({ role, data: { ...current, [field]: value } });
    };

    const addDocument = (type) => {
        if (!projectId) return;
        const newDoc = { name: `${type} №${Math.floor(Math.random()*1000)}/26`, type, date: new Date().toISOString().split('T')[0] };
        upsertDocument(newDoc);
    };

    // Демо-данные
    const autoFill = () => {
        setLocalInfo({
            name: 'ЖК "Grand Workflow"', status: 'Строящийся', 
            region: 'Ташкент', district: 'Мирзо-Улугбекский', street: 'пр. Мустакиллик, 88', landmark: 'Напротив парка',
            dateStartProject: '2023-03-01', dateEndProject: '2025-12-30', dateStartFact: '', dateEndFact: ''
        });
        setLocalCadastre({ number: '11:05:04:02:0077', address: 'г. Ташкент...', area: '1.85' });
    };

    const { errors } = useValidation(ComplexInfoSchema, localInfo);
    const { options: projectStatusOptions } = useCatalog('dict_project_statuses', Object.keys(STATUS_CONFIG));
    const StatusIcon = STATUS_CONFIG[localInfo.status]?.icon || LayoutDashboard;
    const progress = calculateProgress(localInfo.dateStartProject, localInfo.dateEndProject);

    if (isLoading && projectId) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600"/></div>;

    return (
        <div className="w-full px-6 pb-20 animate-in fade-in duration-500 space-y-6">
            
            {/* Хедер с кнопкой Сохранить (если проект новый) */}
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
                                    {localInfo.name || "Новый Проект"}
                                </h1>
                                <div className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                    <span className="flex items-center gap-1"><MapPin size={14}/> {localInfo.street || "Адрес не указан"}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                             {/* Кнопка сохранения/создания */}
                             <Button 
                                onClick={handleManualSave} 
                                disabled={isReadOnly || isSaving}
                                className={`h-9 text-xs ${!projectId ? 'bg-green-600 hover:bg-green-700 animate-pulse' : 'bg-white/10 hover:bg-white/20'}`}
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin mr-2"/> : <Save size={14} className="mr-2"/>}
                                {!projectId ? 'СОЗДАТЬ ПРОЕКТ' : 'Сохранить изменения'}
                            </Button>

                            <Button variant="secondary" onClick={autoFill} disabled={isReadOnly} className="bg-white/10 border-white/10 text-white text-xs h-9">
                                <Wand2 size={14}/> Демо
                            </Button>
                        </div>
                    </div>
                    {/* ... (прогресс бар) */}
                     <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/5 flex items-center gap-6">
                        <div className="flex-1">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                <span>Прогресс</span> <span className="text-white">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{width: `${progress}%`}} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 min-w-[180px]">
                            <StatusIcon size={20} className="text-white"/>
                            <select 
                                value={localInfo.status || 'Проектный'} 
                                onChange={e => handleInfoChange('status', e.target.value)}
                                className="bg-transparent text-sm font-bold text-white outline-none"
                            >
                                {projectStatusOptions.map(s => <option key={s.code} value={s.label} className="text-slate-900">{s.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 shadow-sm">
                        <SectionTitle icon={MapPin}>Основные данные</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="space-y-4">
                                <div>
                                    <Label>Наименование</Label>
                                    <Input value={localInfo.name} onChange={e => handleInfoChange('name', e.target.value)} placeholder="Название ЖК" className={!projectId ? "border-green-300 ring-2 ring-green-50" : ""}/>
                                    {!projectId && <div className="text-[10px] text-green-600 mt-1 font-bold">Введите имя и нажмите "Создать проект"</div>}
                                </div>
                                <div>
                                    <Label>Кадастровый номер</Label>
                                    <Input value={localCadastre.number} onChange={e => handleCadastreChange('number', e.target.value)} placeholder="00:00..."/>
                                </div>
                                <div>
                                    <Label>Адрес</Label>
                                    <Input value={localInfo.street} onChange={e => handleInfoChange('street', e.target.value)} placeholder="Адрес..."/>
                                </div>
                            </div>
                            {/* ... остальная часть формы ... */}
                        </div>
                    </Card>
                    
                    {/* БЛОКИ УЧАСТНИКОВ (Блокируем, если нет ID) */}
                    <div className={!projectId ? "opacity-50 pointer-events-none grayscale" : ""}>
                         {/* Вставьте сюда Card с участниками из предыдущего кода */}
                         <Card className="p-6 shadow-sm"><SectionTitle icon={Briefcase}>Команда (доступно после создания)</SectionTitle></Card>
                    </div>
                </div>

                <div className="space-y-6">
                     {/* БЛОКИ ГРАФИКА И ДОКУМЕНТОВ (Блокируем, если нет ID) */}
                    <div className={!projectId ? "opacity-50 pointer-events-none grayscale" : ""}>
                         {/* Вставьте сюда Card с графиком и документами */}
                         <Card className="p-6 shadow-sm"><SectionTitle icon={Clock}>График (доступно после создания)</SectionTitle></Card>
                    </div>
                </div>
            </div>
        </div>
    );
}