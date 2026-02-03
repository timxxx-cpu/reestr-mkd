import React, { useMemo } from 'react';
import { Save, Car, CheckCircle2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Card, Button, Input, useReadOnly } from '../ui/UIKit'; 
import { getBlocksList } from '../../lib/utils';
// ВАЛИДАЦИЯ
import { ParkingLevelConfigSchema } from '../../lib/schemas';

// Убрали onSave из пропсов
export default function ParkingConfigurator({ buildingId }) {
    const { composition, buildingDetails, setBuildingDetails, parkingPlaces, setParkingPlaces, saveBuildingData, saveData } = useProject();
    const isReadOnly = useReadOnly();

    const building = useMemo(() => 
        buildingId ? composition.find(c => c.id === buildingId) : composition[0]
    , [composition, buildingId]);

    const allRows = useMemo(() => {
        if (!building) return [];
        const rows = [];
        const targetBuildings = buildingId ? [building] : composition; 

        targetBuildings.forEach(b => {
            if (b.category === 'infrastructure') return;

            const blocks = getBlocksList(b);

            blocks.forEach(block => {
                const detailsKey = `${b.id}_${block.id}`;
                const blockDetails = buildingDetails[detailsKey] || {};
                const featuresKey = `${b.id}_features`;
                const features = buildingDetails[featuresKey] || {};
                const basements = features.basements || [];

                const isParkingBuilding = b.category === 'parking_separate';

                const commonData = {
                    buildingId: b.id,
                    buildingLabel: b.label,
                    houseNumber: b.houseNumber, 
                    blockLabel: block.tabLabel,
                    fullId: block.fullId
                };

                if (isParkingBuilding) {
                    const isUnderground = b.parkingType === 'underground';
                    
                    if (isUnderground) {
                        const depth = parseInt(String(blockDetails.levelsDepth || 1), 10);
                        for(let i=1; i<=depth; i++) {
                            rows.push({
                                ...commonData,
                                id: `level_minus_${i}`,
                                label: `Уровень -${i}`,
                                type: 'Подземный',
                                isMandatory: true
                            });
                        }
                    } else {
                        let groundTypeLabel = 'Наземный (Кап.)';
                        if (b.constructionType === 'light') groundTypeLabel = 'Легкие констр.';
                        if (b.constructionType === 'open') groundTypeLabel = 'Открытый';

                        const floors = parseInt(String(blockDetails.floorsCount || 1), 10); 
                        for(let i=1; i<=floors; i++) {
                            rows.push({
                                ...commonData,
                                id: `floor_${i}`,
                                label: b.constructionType === 'open' ? 'Площадка' : `${i} этаж`,
                                type: groundTypeLabel,
                                isMandatory: true
                            });
                        }
                        
                        const parkingBasements = basements.filter(base => base.blocks?.includes(block.id));
                        parkingBasements.forEach((base) => {
                            const bDepth = parseInt(String(base.depth || 1), 10);
                            for (let d = 1; d <= bDepth; d++) {
                                rows.push({
                                    ...commonData,
                                    id: `base_${base.id}_L${d}`,
                                    label: `Подвал -${d}`,
                                    type: 'Подвал',
                                    basementId: base.id,
                                    depthLevel: d,
                                    isMandatory: true
                                });
                            }
                        });
                    }
                }
                else {
                    const blockBasements = basements.filter(base => base.blocks?.includes(block.id));
                    blockBasements.forEach((base, bIdx) => {
                        const bDepth = parseInt(String(base.depth || 1), 10);
                        for (let d = 1; d <= bDepth; d++) {
                            let label = `Подвал -${d}`;
                            if (blockBasements.length > 1) label += ` (Секция ${bIdx+1})`;
                            
                            rows.push({
                                ...commonData,
                                id: `base_${base.id}_L${d}`,
                                label: label,
                                type: 'Подвал',
                                basementId: base.id,
                                depthLevel: d,
                                isMandatory: false
                            });
                        }
                    });
                }
            });
        });

        return rows;
    }, [composition, buildingDetails, building, buildingId]);

    const isParkingEnabled = (lvl) => {
        if (lvl.isMandatory) return true;
        if (lvl.basementId) {
            const features = buildingDetails[`${lvl.buildingId}_features`] || {};
            const basements = features.basements || [];
            const base = basements.find(b => b.id === lvl.basementId);
            if (!base) return false;
            if (base.parkingLevels && base.parkingLevels[lvl.depthLevel] !== undefined) {
                return base.parkingLevels[lvl.depthLevel];
            }
            return base.hasParking || false; 
        }
        const key = `${lvl.fullId}_${lvl.id}_enabled`;
        const val = parkingPlaces[key];
        return val !== undefined ? val : true;
    };

    const getPlacesCount = (lvl) => {
        const key = `${lvl.fullId}_${lvl.id}_meta`;
        return parkingPlaces[key]?.count || '';
    };

    // Хелпер для синхронизации (удаления/создания) мест в стейте с UUID
    const syncPlacesInState = (nextState, lvl, count, isEnabled) => {
        const prefix = `${lvl.fullId}_${lvl.id}_place`;
        
        if (isEnabled && count > 0) {
            // 1. Создаем недостающие
            for (let i = 0; i < count; i++) {
                const placeKey = `${prefix}${i}`;
                if (!nextState[placeKey]) {
                    nextState[placeKey] = {
                        id: crypto.randomUUID(), // UUID
                        number: `${i + 1}`, 
                        area: '13.25',
                        // FKs
                        buildingId: building.id
                    };
                }
            }
            // 2. Удаляем лишние (если уменьшили)
            let i = count;
            while (nextState[`${prefix}${i}`]) {
                delete nextState[`${prefix}${i}`];
                i++;
            }
        } else {
            // Если выключено или 0 — удаляем все
            let i = 0;
            while (nextState[`${prefix}${i}`]) {
                delete nextState[`${prefix}${i}`];
                i++;
            }
        }
        return nextState;
    };

    const toggleParking = (lvl) => {
        if (lvl.isMandatory || isReadOnly) return;
        const currentlyEnabled = isParkingEnabled(lvl);
        const newValue = !currentlyEnabled;

        if (lvl.basementId) {
            const featuresKey = `${lvl.buildingId}_features`;
            const features = buildingDetails[featuresKey] || {};
            const basements = features.basements || [];
            const updatedBasements = basements.map(b => {
                if (b.id !== lvl.basementId) return b;
                const currentLevels = b.parkingLevels || {};
                if (!b.parkingLevels) {
                    for(let d=1; d<=b.depth; d++) currentLevels[d] = b.hasParking || false;
                }
                return {
                    ...b,
                    hasParking: true, 
                    parkingLevels: { ...currentLevels, [lvl.depthLevel]: newValue }
                };
            });
            setBuildingDetails(prev => ({ ...prev, [featuresKey]: { ...features, basements: updatedBasements } }));
        }

        const keyEnabled = `${lvl.fullId}_${lvl.id}_enabled`;
        const keyMeta = `${lvl.fullId}_${lvl.id}_meta`;
        const currentCount = parseInt(getPlacesCount(lvl) || '0');

        setParkingPlaces(prev => {
            const next = { ...prev, [keyEnabled]: newValue };
            
            if (!newValue) {
                // Если ВЫКЛЮЧИЛИ чекбокс:
                // 1. Сбрасываем количество в мета-данных
                if (next[keyMeta]) {
                    next[keyMeta] = { ...next[keyMeta], count: '' };
                }
                // 2. Удаляем все места (передаем 0 и false)
                return syncPlacesInState(next, lvl, 0, false);
            } else {
                // Если ВКЛЮЧИЛИ:
                return syncPlacesInState(next, lvl, currentCount, true);
            }
        });
    };

    const updateCount = (lvl, value) => {
        if (isReadOnly) return;
        
        const keyMeta = `${lvl.fullId}_${lvl.id}_meta`;
        const newCount = parseInt(value || '0');
        const isEnabled = isParkingEnabled(lvl);

        setParkingPlaces(prev => {
            const next = { 
                ...prev,
                [keyMeta]: { ...prev[keyMeta], count: value } 
            };
            return syncPlacesInState(next, lvl, newCount, isEnabled);
        });
    };

    // Функция сохранения теперь используется только внутри (если нужно)
    // но в текущей архитектуре сохранение происходит через верхний бар
    // eslint-disable-next-line no-unused-vars
    const handleSave = async () => {
        const specificData = {};
        if (buildingId) {
            Object.keys(parkingPlaces).forEach(k => {
                if (k.startsWith(buildingId)) {
                    specificData[k] = parkingPlaces[k];
                }
            });
            // Используем сервис с трансформацией внутри
            await saveBuildingData(building.id, 'parkingData', specificData);
        }
        await saveData({}, true); 
    };

    const getBadgeStyle = (type) => {
        if (type === 'Подземный') return 'bg-slate-800 text-white border-slate-800';
        if (type === 'Подвал') return 'bg-slate-100 text-slate-500 border-slate-200';
        if (type === 'Открытый') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        return 'bg-blue-100 text-blue-700 border-blue-200';
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 leading-tight">Конфигурация паркингов</h2>
                    <p className="text-slate-500 text-sm mt-1">Отметьте уровни, где размещаются машиноместа, и укажите их количество</p>
                </div>
            </div>

            {allRows.length > 0 ? (
                <Card className="overflow-hidden shadow-lg border-0 ring-1 ring-slate-200 rounded-xl">
                    <table className="w-full border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase">
                            <tr>
                                <th className="p-4 text-left w-[8%]">Дом</th>
                                <th className="p-4 text-left w-[18%]">Здание</th>
                                <th className="p-4 text-left w-[15%]">Блок</th>
                                <th className="p-4 text-left w-[15%]">Тип</th>
                                <th className="p-4 text-left w-[14%]">Уровень</th>
                                <th className="p-4 text-center w-[10%]">Статус</th>
                                <th className="p-4 text-left w-[20%]">Количество мест</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {allRows.map((lvl, idx) => {
                                const isEnabled = isParkingEnabled(lvl);
                                const count = getPlacesCount(lvl);
                                const uniqueKey = `${lvl.fullId}_${lvl.id}`;
                                
                                const validationResult = ParkingLevelConfigSchema.safeParse({ count });
                                const isInvalid = !validationResult.success && count !== '';

                                return (
                                    <tr key={uniqueKey} className={`transition-colors ${isEnabled ? 'bg-white' : 'bg-slate-50/50'}`}>
                                        <td className="p-4">
                                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">{lvl.houseNumber}</span>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-slate-700">{lvl.buildingLabel}</td>
                                        <td className="p-4"><span className="text-xs font-medium text-slate-500">{lvl.blockLabel}</span></td>
                                        <td className="p-4"><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${getBadgeStyle(lvl.type)}`}>{lvl.type}</span></td>
                                        <td className="p-4"><div className="flex flex-col"><span className={`font-bold text-sm ${isEnabled ? 'text-slate-800' : 'text-slate-400'}`}>{lvl.label}</span></div></td>
                                        
                                        <td className="p-4 text-center">
                                            <label className={`flex items-center justify-center group relative ${lvl.isMandatory || isReadOnly ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                                                <input type="checkbox" className="peer sr-only" checked={isEnabled} disabled={lvl.isMandatory || isReadOnly} onChange={() => toggleParking(lvl)}/>
                                                {lvl.isMandatory ? (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100"><CheckCircle2 size={12}/><span>АКТИВЕН</span></div>
                                                ) : (
                                                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 relative"></div>
                                                )}
                                            </label>
                                        </td>

                                        <td className="p-4">
                                            <div className={`flex items-center gap-3 transition-opacity duration-200 ${isEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none'}`}>
                                                <div className="relative max-w-xs w-32">
                                                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none"><Car size={14} className="text-slate-400" /></div>
                                                    <Input 
                                                        type="number" 
                                                        min="0" 
                                                        className={`pl-8 pr-3 py-2 w-full border rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all ${isInvalid ? 'border-red-500 bg-red-50' : 'border-slate-200'} ${isReadOnly ? 'bg-transparent border-transparent cursor-default' : ''}`} 
                                                        placeholder="0" 
                                                        value={count} 
                                                        onChange={(e) => updateCount(lvl, e.target.value)}
                                                        disabled={isReadOnly}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-500 font-medium">мест</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
            ) : (
                <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Car size={48} className="mx-auto mb-4 text-slate-300 opacity-50"/>
                    <p className="font-medium">Нет уровней для конфигурации паркинга.</p>
                    <p className="text-xs mt-2 max-w-sm mx-auto">В проекте нет зданий типа "Паркинг" и жилых домов с подвалами.</p>
                </div>
            )}
        </div>
    );
}