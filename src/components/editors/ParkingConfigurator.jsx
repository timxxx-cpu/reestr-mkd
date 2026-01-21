import React, { useMemo } from 'react';
import { Save, Car, Building2, CheckCircle2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Button } from '../ui/UIKit';

export default function ParkingConfigurator({ onSave }) {
    const { composition, buildingDetails, setBuildingDetails, saveData } = useProject();

    // Фильтруем здания: оставляем только Отдельные паркинги ИЛИ дома с подвалами
    const items = useMemo(() => {
        return composition.filter(b => {
            const isSepParking = b.category === 'parking_separate';
            const features = buildingDetails[`${b.id}_features`] || {};
            const hasBasements = (features.basements || []).length > 0;
            return isSepParking || hasBasements;
        });
    }, [composition, buildingDetails]);

    const toggleLevelParking = (buildingId, basementId, levelIndex) => {
        const featuresKey = `${buildingId}_features`;
        const features = buildingDetails[featuresKey] || {};
        const basements = features.basements || [];
        
        const updatedBasements = basements.map(b => {
            if (b.id !== basementId) return b;
            
            // Если массив уровней еще не создан, инициализируем его текущим значением hasParking
            const currentLevels = b.parkingLevels || {};
            if (!b.parkingLevels) {
                for (let d = 1; d <= b.depth; d++) {
                    currentLevels[d] = b.hasParking; 
                }
            }
            
            // Переключаем значение для конкретного уровня
            const newValue = currentLevels[levelIndex] !== undefined ? !currentLevels[levelIndex] : !b.hasParking;
            
            return {
                ...b,
                parkingLevels: {
                    ...currentLevels,
                    [levelIndex]: newValue
                }
            };
        });

        setBuildingDetails(prev => ({
            ...prev,
            [featuresKey]: { ...features, basements: updatedBasements }
        }));
    };

    const handleSave = () => {
        if (onSave) onSave(); // Вызываем колбэк сохранения (переход дальше)
        saveData(); // Сохраняем в контекст/БД
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Конфигурация паркингов</h1>
                    <p className="text-slate-500 text-sm mt-1">Определение зон, в которых предусмотрены машиноместа</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSave}><Save size={14}/> Сохранить</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.length === 0 && (
                    <div className="col-span-full p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                        <Car size={48} className="mx-auto mb-4 text-slate-300 opacity-50"/>
                        <p className="font-medium">Нет зданий с подвалами или отдельных паркингов.</p>
                        <p className="text-xs mt-2">Добавьте уровни в разделе "Конфигурация" (Шаг 3 или 4).</p>
                    </div>
                )}

                {items.map(b => {
                    const features = buildingDetails[`${b.id}_features`] || {};
                    const basements = features.basements || [];
                    const isSepParking = b.category === 'parking_separate';
                    
                    return (
                        <Card key={b.id} className="p-6 h-full flex flex-col hover:shadow-md transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`p-2 rounded-lg ${isSepParking ? 'bg-slate-800 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                            {isSepParking ? <Car size={16}/> : <Building2 size={16}/>}
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-sm">{b.label}</h3>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide ml-1">{b.type}</span>
                                </div>
                            </div>

                            <div className="space-y-3 flex-1">
                                {isSepParking && (
                                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                                        <CheckCircle2 size={16} className="text-emerald-500"/>
                                        <span className="text-xs font-bold text-slate-600">Это здание — Паркинг</span>
                                    </div>
                                )}
                                
                                {basements.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Подземные уровни</div>
                                        {basements.map((base) => {
                                            const levels = Array.from({length: base.depth}, (_, i) => i + 1);
                                            return (
                                                <div key={base.id} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-50">
                                                        <div className="text-[10px] font-bold text-slate-400">Глубина: {base.depth} ур.</div>
                                                        <div className="text-[9px] text-slate-400">{(base.blocks||[]).length} блоков</div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {levels.map(level => {
                                                            // Проверяем статус для конкретного уровня. Если нет - берем общий hasParking
                                                            const isChecked = base.parkingLevels ? (base.parkingLevels[level] ?? base.hasParking) : base.hasParking;
                                                            
                                                            return (
                                                                <label key={level} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                                                                    <span className="text-xs font-bold text-slate-700">Уровень -{level}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[9px] font-bold uppercase transition-colors ${isChecked ? 'text-blue-600' : 'text-slate-300'}`}>
                                                                            {isChecked ? 'Паркинг' : 'Нет'}
                                                                        </span>
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={isChecked || false} 
                                                                            onChange={() => toggleLevelParking(b.id, base.id, level)}
                                                                            className="rounded text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                                                                        />
                                                                    </div>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                
                                {!isSepParking && basements.length === 0 && (
                                    <div className="text-xs text-slate-400 italic text-center py-4">
                                        Нет настроенных подземных уровней
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}