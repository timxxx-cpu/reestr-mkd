import React, { useState } from 'react';
import { 
  LayoutDashboard, MapPin, Briefcase, FileText, Clock, 
  Search, Plus, Trash2, Loader2, Save, Wand2 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, SectionTitle, Label, Input, Select, Button } from '../ui/UIKit';

// Вспомогательная функция для расчета прогресса
function calculateProgress(start, end) {
    if (!start || !end) return 0;
    const total = new Date(end).getTime() - new Date(start).getTime();
    const current = new Date().getTime() - new Date(start).getTime();
    return total <= 0 ? 0 : Math.min(100, Math.max(0, (current / total) * 100));
}

export default function PassportEditor() {
    const { 
        complexInfo, setComplexInfo, 
        participants, setParticipants, 
        cadastre, setCadastre, 
        documents, setDocuments, 
        saveData 
    } = useProject();

    // Локальные состояния для загрузчиков
    const [loadingInn, setLoadingInn] = useState({});
    const [loadingCadastre, setLoadingCadastre] = useState(false);

    // --- Функции-имитаторы API ---

    const fetchCadastreInfo = () => {
        if (!cadastre.number) return;
        setLoadingCadastre(true);
        // Имитация запроса
        setTimeout(() => {
            setCadastre(prev => ({ 
                ...prev, 
                address: "г. Ташкент, Юнусабадский р-н, ул. Амира Темура, 108", 
                area: "2.5 га" 
            }));
            setComplexInfo(prev => ({
                ...prev,
                region: "Ташкент",
                district: "Юнусабадский р-н",
                street: "ул. Амира Темура, 108"
            }));
            setLoadingCadastre(false);
        }, 800);
    };

    const fetchParticipant = (role) => {
        const inn = participants[role]?.inn;
        if (!inn) return;
        
        setLoadingInn(p => ({ ...p, [role]: true }));
        setTimeout(() => {
            setParticipants(prev => ({
                ...prev,
                [role]: { ...prev[role], name: `ООО "Компания ${inn}"`, loading: false }
            }));
            setLoadingInn(p => ({ ...p, [role]: false }));
        }, 600);
    };

    // --- Управление документами ---

    const addDocument = (type) => {
        const newDoc = { 
            id: Date.now(), 
            name: `${type} №${Math.floor(Math.random()*1000)}`, 
            type, 
            date: new Date().toISOString().split('T')[0] 
        };
        setDocuments(prev => [...prev, newDoc]);
    };

    const removeDocument = (id) => {
        setDocuments(prev => prev.filter(d => d.id !== id));
    };

    // --- Автозаполнение ---
    const autoFill = () => {
        setComplexInfo({
            name: 'ЖК "Мегаполис Сити"', 
            status: 'Строящийся', 
            region: 'Ташкент', 
            district: 'Юнусабадский р-н', 
            street: 'ул. Амира Темура, 108', 
            landmark: 'Ориентир: Телебашня',
            dateStartProject: '2023-01-10', 
            dateStartFact: '2023-02-01', 
            dateEndProject: '2027-12-31', 
            dateEndFact: ''
        });
        setParticipants({
            developer: { inn: '123456789', name: 'ООО "Global Development"' },
            designer: { inn: '987654321', name: 'ЧП "City Architects"' },
            contractor: { inn: '456123789', name: 'АО "Tashkent Construction"' }
        });
        setCadastre({ 
            number: '71:01:04:02:0099', 
            address: 'г. Ташкент, Юнусабадский р-н, ул. Амира Темура, 108', 
            area: '2.5 га' 
        });
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
            {/* Заголовок */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Паспорт объекта</h1>
                    <p className="text-slate-500 text-sm mt-1">Базовые данные, участники и сроки</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFill} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-100 transition-colors">
                        <Wand2 size={14}/> Заполнить
                    </button>
                    <Button onClick={() => saveData()}><Save size={14}/> Сохранить</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Левая колонка */}
                <div className="space-y-6">
                    {/* 1. Идентификация */}
                    <Card className="p-6">
                        <SectionTitle icon={LayoutDashboard}>Идентификация</SectionTitle>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label required>Название ЖК</Label>
                                <Input 
                                    value={complexInfo.name || ''} 
                                    onChange={e => setComplexInfo({...complexInfo, name: e.target.value})} 
                                    placeholder="Например: ЖК Новый Горизонт" 
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Стадия реализации</Label>
                                <Select 
                                    value={complexInfo.status} 
                                    onChange={e => setComplexInfo({...complexInfo, status: e.target.value})}
                                >
                                    <option>Проектный</option>
                                    <option>Строящийся</option>
                                    <option>Готовый к вводу</option>
                                    <option>Введенный</option>
                                </Select>
                            </div>
                        </div>
                    </Card>

                    {/* 2. Локация и Кадастр */}
                    <Card className="p-6">
                        <SectionTitle icon={MapPin}>Локация</SectionTitle>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label>Кадастровый номер</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        value={cadastre.number || ''} 
                                        onChange={e => setCadastre({...cadastre, number: e.target.value})} 
                                        placeholder="00:00:00:00:0000" 
                                    />
                                    <Button variant="secondary" onClick={fetchCadastreInfo} disabled={loadingCadastre}>
                                        {loadingCadastre ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
                                    </Button>
                                </div>
                            </div>
                            
                            {cadastre.address && (
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
                                    <span className="font-bold block mb-1">Адрес по кадастру:</span>
                                    {cadastre.address}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1">
                                    <Label>Регион</Label>
                                    <Input 
                                        value={complexInfo.region || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, region: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Район</Label>
                                    <Input 
                                        value={complexInfo.district || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, district: e.target.value})} 
                                    />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <Label>Улица / Ориентир</Label>
                                    <Input 
                                        value={complexInfo.street || ''} 
                                        onChange={e => setComplexInfo({...complexInfo, street: e.target.value})} 
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Правая колонка */}
                <div className="space-y-6">
                    {/* 3. Участники */}
                    <Card className="p-6">
                        <SectionTitle icon={Briefcase}>Участники проекта</SectionTitle>
                        <div className="space-y-6">
                            {[
                                { id: 'developer', label: 'Застройщик' },
                                { id: 'designer', label: 'Проектировщик' },
                                { id: 'contractor', label: 'Генподрядчик' }
                            ].map(role => (
                                <div key={role.id} className="space-y-1">
                                    <Label>{role.label}</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="ИНН" 
                                            value={participants[role.id]?.inn || ''} 
                                            onChange={e => setParticipants({...participants, [role.id]: {...participants[role.id], inn: e.target.value}})}
                                        />
                                        <Button variant="secondary" onClick={() => fetchParticipant(role.id)} disabled={loadingInn[role.id]}>
                                            {loadingInn[role.id] ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
                                        </Button>
                                    </div>
                                    {participants[role.id]?.name && (
                                        <div className="text-xs font-bold text-blue-600 px-1 pt-1">
                                            {participants[role.id].name}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* 4. Сроки */}
                    <Card className="p-6">
                        <SectionTitle icon={Clock}>Сроки строительства</SectionTitle>
                        
                        {complexInfo.dateStartProject && complexInfo.dateEndProject && (
                            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2">
                                    <span>Прогресс (по времени)</span>
                                    <span>{Math.round(calculateProgress(complexInfo.dateStartProject, complexInfo.dateEndProject))}%</span>
                                </div>
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                        style={{width: `${calculateProgress(complexInfo.dateStartProject, complexInfo.dateEndProject)}%`}}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Начало (Проект)</Label>
                                <Input type="date" value={complexInfo.dateStartProject || ''} onChange={e => setComplexInfo({...complexInfo, dateStartProject: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <Label>Окончание (Проект)</Label>
                                <Input type="date" value={complexInfo.dateEndProject || ''} onChange={e => setComplexInfo({...complexInfo, dateEndProject: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <Label>Начало (Факт)</Label>
                                <Input type="date" value={complexInfo.dateStartFact || ''} onChange={e => setComplexInfo({...complexInfo, dateStartFact: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <Label>Окончание (Факт)</Label>
                                <Input type="date" value={complexInfo.dateEndFact || ''} onChange={e => setComplexInfo({...complexInfo, dateEndFact: e.target.value})} />
                            </div>
                        </div>
                    </Card>

                    {/* 5. Документы */}
                    <Card className="p-6">
                        <SectionTitle icon={FileText}>Документация</SectionTitle>
                        
                        <div className="space-y-2 mb-4">
                            {documents.length === 0 && (
                                <div className="text-center py-4 text-slate-400 text-xs border-2 border-dashed border-slate-100 rounded-xl">
                                    Нет документов
                                </div>
                            )}
                            {documents.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-500">
                                            <FileText size={14}/>
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-700">{doc.name}</div>
                                            <div className="text-[10px] text-slate-400">{doc.type} • {doc.date}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => removeDocument(doc.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => addDocument('РНР')} className="flex-1 text-[10px]">
                                <Plus size={12}/> РНР
                            </Button>
                            <Button variant="ghost" onClick={() => addDocument('ГПЗУ')} className="flex-1 text-[10px]">
                                <Plus size={12}/> ГПЗУ
                            </Button>
                            <Button variant="ghost" onClick={() => addDocument('Экспертиза')} className="flex-1 text-[10px]">
                                <Plus size={12}/> Экспертиза
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}