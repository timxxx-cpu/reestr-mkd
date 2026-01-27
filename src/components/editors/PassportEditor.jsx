import React, { useState } from 'react';
import { 
  LayoutDashboard, MapPin, Briefcase, FileText, Clock, 
  Search, Plus, Trash2, Loader2, Save, Wand2, Building, 
  CheckCircle2, AlertCircle, FileBadge, Calendar, ArrowRight,
  Activity
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, Button } from '../ui/UIKit';
import SaveFloatingBar from '../ui/SaveFloatingBar'; // [NEW] Импорт
import { calculateProgress } from '../../lib/utils';
// ИМПОРТЫ ДЛЯ ВАЛИДАЦИИ
import { ComplexInfoSchema } from '../../lib/schemas';
import { useValidation } from '../../hooks/useValidation';

/**
 * @param {string} start
 * @param {string} end
 */
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
    const { 
        complexInfo, setComplexInfo, 
        participants, setParticipants, 
        cadastre, setCadastre, 
        documents, setDocuments, 
        saveData 
    } = useProject();

    const [loadingInn, setLoadingInn] = useState({});
    const [loadingCadastre, setLoadingCadastre] = useState(false);

    // ПОДКЛЮЧЕНИЕ ВАЛИДАЦИИ
    const { errors, isValid } = useValidation(ComplexInfoSchema, complexInfo);

    // --- Имитация API ---
    const fetchCadastreInfo = () => {
        if (!cadastre.number) return;
        setLoadingCadastre(true);
        setTimeout(() => {
            setCadastre(prev => ({ ...prev, address: "г. Ташкент, Мирзо-Улугбекский р-н, пр. Мустакиллик, 88", area: "1.85 га" }));
            setComplexInfo(prev => ({ ...prev, region: "Ташкент", district: "Мирзо-Улугбекский", street: "пр. Мустакиллик, 88" }));
            setLoadingCadastre(false);
        }, 800);
    };

    /** @param {string} role */
    const fetchParticipant = (role) => {
        // @ts-ignore
        const inn = participants[role]?.inn;
        if (!inn) return;
        // @ts-ignore
        setLoadingInn(p => ({ ...p, [role]: true }));
        setTimeout(() => {
            // @ts-ignore
            setParticipants(prev => ({ ...prev, [role]: { ...prev[role], name: `ООО "Строй-Гигант ${inn.slice(-3)}"`, loading: false } }));
            // @ts-ignore
            setLoadingInn(p => ({ ...p, [role]: false }));
        }, 600);
    };

    /** @param {string} type */
    const addDocument = (type) => {
        const newDoc = { id: crypto.randomUUID(), name: `${type} №${Math.floor(Math.random()*1000)}/24`, type, date: new Date().toISOString().split('T')[0] };
        // @ts-ignore
        setDocuments([...documents, newDoc]);
    };

    const autoFill = () => {
        setComplexInfo({
            name: 'ЖК "Grand Capital"', status: 'Строящийся', 
            region: 'Ташкент', district: 'Мирзо-Улугбекский', street: 'пр. Мустакиллик, 88', landmark: 'Напротив парка',
            dateStartProject: '2023-03-01', dateEndProject: '2025-12-30', 
            dateStartFact: '2023-04-10', dateEndFact: ''
        });
        setParticipants({
            developer: { inn: '202020202', name: 'ООО "Golden House Develop"' },
            designer: { inn: '303030303', name: 'ЧП "Urban Arch Studio"' },
            contractor: { inn: '404040404', name: 'АО "Tashkent City Stroy"' }
        });
        setCadastre({ number: '11:05:04:02:0077', address: 'г. Ташкент, Мирзо-Улугбекский р-н, пр. Мустакиллик, 88', area: '1.85 га' });
    };

    // [NEW] Функция сохранения
    const handleSave = async () => {
        // Мы просто вызываем сохранение легких данных (которые теперь стали "тяжелыми" в плане флага)
        await saveData({ 
            complexInfo, 
            participants, 
            cadastre, 
            documents 
        }, true);
    };

    const progress = calculateProgress(complexInfo.dateStartProject, complexInfo.dateEndProject);
    // @ts-ignore
    const StatusIcon = STATUS_CONFIG[complexInfo.status]?.icon || LayoutDashboard;

    const durProject = getDuration(complexInfo.dateStartProject, complexInfo.dateEndProject);
    const durFact = getDuration(complexInfo.dateStartFact, complexInfo.dateEndFact);

    // Хелпер для отображения ошибки
    const ErrorMsg = ({ field }) => errors[field] ? <span className="text-[9px] text-red-500 font-bold ml-2 animate-in fade-in">{errors[field]}</span> : null;

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500 space-y-6">
            
            {/* --- HERO HEADER --- */}
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
                                    {complexInfo.name || "Новый Жилой Комплекс"}
                                </h1>
                                <div className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                                    <span className="flex items-center gap-1"><MapPin size={14}/> {complexInfo.street || "Адрес не указан"}</span>
                                    {cadastre.area && <span className="bg-white/10 px-2 py-0.5 rounded text-white text-xs">{cadastre.area}</span>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 items-end">
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={autoFill} className="bg-white/10 border-white/10 text-white hover:bg-white/20 text-xs h-9">
                                    <Wand2 size={14}/> Демо
                                </Button>
                                {/* [REMOVED] Кнопка сохранения удалена из хедера */}
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/5 flex items-center gap-6">
                        <div className="flex-1">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                <span>Прогресс строительства</span>
                                <span className="text-white">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-1000" style={{width: `${progress}%`}} />
                            </div>
                        </div>
                        <div className="h-8 w-px bg-white/10"></div>
                        <div className="flex items-center gap-3 min-w-[180px]">
                            <div className={`p-2 rounded-lg ${
                                // @ts-ignore
                                STATUS_CONFIG[complexInfo.status]?.color || 'bg-slate-500'}`}>
                                <StatusIcon size={20} className="text-white"/>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">Статус</div>
                                <select 
                                    value={complexInfo.status} 
                                    onChange={e => setComplexInfo({...complexInfo, status: e.target.value})}
                                    className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer hover:text-blue-300 transition-colors appearance-none"
                                >
                                    {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* --- ЛЕВАЯ КОЛОНКА (2/3) --- */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* ОСНОВНЫЕ ДАННЫЕ */}
                    <Card className="p-0 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <SectionTitle icon={MapPin} className="mb-0">Основные данные</SectionTitle>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2">
                            {/* Форма */}
                            <div className="p-6 space-y-5">
                                <div className="space-y-1.5">
                                    <Label>Наименование ЖК / Проекта <ErrorMsg field="name"/></Label>
                                    <Input 
                                        value={complexInfo.name || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, name: e.target.value})} 
                                        placeholder="Например: ЖК 'Grand Capital'" 
                                        className={`font-bold text-base ${errors.name ? 'border-red-300 bg-red-50' : ''}`}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Кадастровый номер</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={cadastre.number || ''} 
                                            onChange={e => setCadastre({...cadastre, number: e.target.value})} 
                                            placeholder="00:00:00:00:0000" 
                                            className="font-mono text-sm"
                                        />
                                        <Button variant="secondary" onClick={fetchCadastreInfo} disabled={loadingCadastre} className="shrink-0">
                                            {loadingCadastre ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Район</Label>
                                    <Input 
                                        value={complexInfo.district || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, district: e.target.value})} 
                                        placeholder="Район"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Улица / Адрес <ErrorMsg field="street"/></Label>
                                    <textarea 
                                        className={`w-full p-3 bg-slate-50 border rounded-xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all resize-none h-24 ${errors.street ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                        value={complexInfo.street || ''}
                                        onChange={e => setComplexInfo({...complexInfo, street: e.target.value})}
                                        placeholder="Полный адрес..."
                                    />
                                </div>
                            </div>
                            
                            {/* Карта */}
                            <div className="bg-slate-100 relative min-h-[250px] border-l border-slate-100">
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
                                    <MapPin size={48} className="mb-2 opacity-20"/>
                                    <span className="text-xs font-bold uppercase opacity-50">Карта местности</span>
                                    {cadastre.address && <div className="mt-4 px-4 py-2 bg-white/80 backdrop-blur rounded-lg text-[10px] font-bold shadow-sm max-w-[200px] text-center">{cadastre.address}</div>}
                                </div>
                                <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                            </div>
                        </div>
                    </Card>

                    {/* УЧАСТНИКИ */}
                    <Card className="p-6 shadow-sm">
                        <SectionTitle icon={Briefcase}>Команда проекта</SectionTitle>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            {[
                                { id: 'developer', label: 'Застройщик', color: 'blue' },
                                { id: 'designer', label: 'Проектировщик', color: 'purple' },
                                { id: 'contractor', label: 'Генподрядчик', color: 'orange' }
                            ].map(role => (
                                <div key={role.id} className="group relative p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-lg transition-all duration-300">
                                    <div className={`absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                                        {/* @ts-ignore */}
                                        <Button variant="ghost" onClick={() => fetchParticipant(role.id)} className="h-6 w-6 p-0 rounded-full" disabled={loadingInn[role.id]}>
                                            {/* @ts-ignore */}
                                            {loadingInn[role.id] ? <Loader2 size={12} className="animate-spin"/> : <Search size={12}/>}
                                        </Button>
                                    </div>
                                    
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{role.label}</div>
                                    
                                    <div className="mb-3">
                                        <Input 
                                            className="bg-transparent border-transparent px-0 py-0 h-auto text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:bg-white focus:px-2 focus:py-1 focus:border-blue-200" 
                                            placeholder="Наименование организации"
                                            // @ts-ignore
                                            value={participants[role.id]?.name || ''}
                                            // @ts-ignore
                                            onChange={e => setParticipants({...participants, [role.id]: {...participants[role.id], name: e.target.value}})}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">ИНН</span>
                                        <input 
                                            className="bg-transparent outline-none text-xs font-mono text-slate-600 w-full"
                                            placeholder="Введите ИНН"
                                            // @ts-ignore
                                            value={participants[role.id]?.inn || ''}
                                            // @ts-ignore
                                            onChange={e => setParticipants({...participants, [role.id]: {...participants[role.id], inn: e.target.value}})}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* --- ПРАВАЯ КОЛОНКА (1/3) --- */}
                <div className="space-y-6">
                    
                    {/* НОВЫЙ БЛОК: СРОКИ РЕАЛИЗАЦИИ */}
                    <Card className="p-5 shadow-sm h-auto flex flex-col">
                        <SectionTitle icon={Clock}>График реализации</SectionTitle>
                        
                        {/* 1. Блок: План (Проект) */}
                        <div className={`bg-slate-50 rounded-2xl p-4 border mb-4 relative overflow-hidden transition-colors ${errors.dateEndProject ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}>
                            {durProject && <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 text-[9px] font-bold px-2 py-1 rounded-bl-lg">{durProject}</div>}
                            
                            <div className="flex items-center gap-2 mb-3 text-slate-500">
                                <Calendar size={14} />
                                <span className="text-xs font-bold uppercase tracking-wider">Проектный план</span>
                            </div>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-slate-400 font-semibold mb-1 block">Начало строительства</label>
                                    <Input 
                                        type="date" 
                                        className="bg-white"
                                        value={complexInfo.dateStartProject || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, dateStartProject: e.target.value})} 
                                    />
                                </div>
                                <div className="flex justify-center text-slate-300">
                                    <ArrowRight size={14} className="rotate-90"/>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 font-semibold mb-1 flex justify-between">
                                        Ввод в эксплуатацию 
                                    </label>
                                    <Input 
                                        type="date" 
                                        className={`bg-white ${errors.dateEndProject ? 'border-red-300 ring-2 ring-red-100' : ''}`}
                                        value={complexInfo.dateEndProject || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, dateEndProject: e.target.value})} 
                                    />
                                    {errors.dateEndProject && <p className="text-[9px] text-red-500 font-bold mt-1 text-right">{errors.dateEndProject}</p>}
                                </div>
                            </div>
                        </div>

                        {/* 2. Блок: Факт */}
                        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 relative overflow-hidden">
                             {durFact && <div className="absolute top-0 right-0 bg-blue-200 text-blue-700 text-[9px] font-bold px-2 py-1 rounded-bl-lg">{durFact}</div>}
                             
                             <div className="flex items-center gap-2 mb-3 text-blue-600">
                                <Activity size={14} />
                                <span className="text-xs font-bold uppercase tracking-wider">Фактическое выполнение</span>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-blue-400 font-semibold mb-1 block">Фактическое начало</label>
                                    <Input 
                                        type="date" 
                                        className="bg-white border-blue-200 focus:border-blue-400"
                                        value={complexInfo.dateStartFact || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, dateStartFact: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-blue-400 font-semibold mb-1 block">Фактическая сдача</label>
                                    <Input 
                                        type="date" 
                                        className="bg-white border-blue-200 focus:border-blue-400"
                                        value={complexInfo.dateEndFact || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, dateEndFact: e.target.value})} 
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* ДОКУМЕНТЫ */}
                    <Card className="p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <SectionTitle icon={FileText} className="mb-0">Документы</SectionTitle>
                            <div className="flex gap-1">
                                <button onClick={() => addDocument('РНР')} title="Разрешение" className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Plus size={14}/></button>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                            {documents.length === 0 && <div className="text-center text-xs text-slate-400 py-4 italic">Нет документов</div>}
                            {documents.map(doc => (
                                <div key={doc.id} className="group flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-200 transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="shrink-0 p-2 bg-white rounded-lg text-blue-500 shadow-sm">
                                            <FileBadge size={16}/>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-700 truncate">{doc.name}</div>
                                            <div className="text-[10px] text-slate-400">{doc.date}</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setDocuments(documents.filter(x => x.id !== doc.id))} 
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all"
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </Card>

                </div>
            </div>

            {/* [NEW] ПАНЕЛЬ СОХРАНЕНИЯ */}
            <SaveFloatingBar onSave={handleSave} disabled={!isValid} />
        </div>
    );
}