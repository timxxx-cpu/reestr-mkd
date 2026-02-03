import React, { useState, useEffect } from 'react';
import { Home, Briefcase, Car, Loader2 } from 'lucide-react';
import { useProject } from '../../../context/ProjectContext';
import { useToast } from '../../../context/ToastContext';
import { TabButton } from '../../ui/UIKit';

// Импорт видов
import ApartmentsRegistry from './views/ApartmentsRegistry';
import CommercialRegistry from './views/CommercialRegistry';
import ParkingRegistry from './views/ParkingRegistry';

const MODES = {
    apartments: { component: ApartmentsRegistry, icon: Home, title: 'Квартиры' },
    commercial: { component: CommercialRegistry, icon: Briefcase, title: 'Коммерция' },
    parking: { component: ParkingRegistry, icon: Car, title: 'Паркинг' }
};

export default function UnitRegistry({ mode = 'apartments' }) {
    const { 
        flatMatrix, setFlatMatrix, 
        parkingPlaces, setParkingPlaces, 
        saveProjectImmediate 
    } = useProject();
    
    const toast = useToast();
    const [activeTab, setActiveTab] = useState(mode);
    const [isSaving, setIsSaving] = useState(false);

    // Синхронизация с внешним переключением шагов
    useEffect(() => {
        if (MODES[mode]) {
            setActiveTab(mode);
        }
    }, [mode]);

    // Единая логика сохранения для всех реестров
    const handleSaveUnit = async (originalUnit, changes, category) => {
        setIsSaving(true);
        try {
            const isParking = category === 'parking';
            const sourceData = isParking ? parkingPlaces : flatMatrix;
            const setSourceData = isParking ? setParkingPlaces : setFlatMatrix;

            // 1. Получаем существующие данные (если объект уже сохранен)
            const existingData = originalUnit.isSaved ? sourceData[originalUnit.id] : {};

            // 2. Обработка экспликации (комнат)
            let finalExplication = [];
            if (Array.isArray(changes.roomsList)) finalExplication = changes.roomsList;
            else if (Array.isArray(originalUnit.explication)) finalExplication = originalUnit.explication;
            else if (existingData && Array.isArray(existingData.explication)) finalExplication = existingData.explication;

            // 3. Формируем финальный ID (UUID)
            const finalUuid = originalUnit.uuid || crypto.randomUUID();

            // 4. Слияние данных: Существующие -> Данные из UI -> Новые изменения
            const mergedData = { ...existingData, ...originalUnit, ...changes };

            // 5. Очистка payload от UI-полей (оставляем только данные для БД)
            // ВАЖНО: Все поля должны быть определены (не undefined)
            const cleanPayload = {
                id: finalUuid,
                isSaved: true,
                
                num: mergedData.number || mergedData.num || '',     
                number: mergedData.number || mergedData.num || '',  
                
                area: mergedData.area || '0',
                type: mergedData.type || 'flat',
                
                // Специфичные поля с дефолтными значениями, чтобы избежать undefined
                livingArea: mergedData.livingArea || '0',
                usefulArea: mergedData.usefulArea || '0',
                rooms: mergedData.rooms || 0,
                isSold: mergedData.isSold || false, // Для паркинга
                
                explication: finalExplication || [],

                // Связи (FK) - убедимся, что они есть
                buildingId: mergedData.buildingId || null,
                blockId: mergedData.blockId || null,
                floorId: mergedData.floorId || null,
                entrance: mergedData.entrance || null
            };

            // Ключ в объекте состояния. 
            // Для виртуальных объектов используем их временный ID как ключ, чтобы они перестали быть виртуальными.
            const storageKey = originalUnit.id;

            // 6. Обновление стейта
            setSourceData(prev => ({
                ...prev,
                [storageKey]: cleanPayload
            }));

            // 7. Сохранение в Firebase
            setTimeout(async () => {
                try {
                    await saveProjectImmediate();
                    toast.success('Сохранено');
                } catch (e) {
                    console.error("Save error:", e);
                    toast.error('Ошибка сохранения в БД: ' + (e.message || 'Unknown error'));
                }
            }, 100);

        } catch (error) {
            console.error("Global save error:", error);
            toast.error('Критическая ошибка сохранения');
        } finally {
            setIsSaving(false);
        }
    };

    const ActiveComponent = MODES[activeTab]?.component || ApartmentsRegistry;

    return (
        <div className="w-full pb-24 space-y-6 animate-in fade-in">
            
            {/* Шапка */}
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 px-6 pt-2">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
                        {React.createElement(MODES[activeTab].icon, { className: "text-blue-600" })}
                        <span>{MODES[activeTab].title}</span>
                    </h1>
                    {isSaving && (
                        <div className="flex items-center gap-2 text-blue-600 text-xs font-bold animate-pulse">
                            <Loader2 size={14} className="animate-spin"/> Сохранение...
                        </div>
                    )}
                </div>
                
                {/* Переключатель вкладок */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-max">
                    {Object.entries(MODES).map(([key, config]) => (
                        <TabButton 
                            key={key} 
                            active={activeTab === key} 
                            onClick={() => setActiveTab(key)}
                        >
                            <config.icon size={16} className="mr-2 opacity-70"/> 
                            {config.title}
                        </TabButton>
                    ))}
                </div>
            </div>

            {/* Контент */}
            <div className="px-6">
                <ActiveComponent onSaveUnit={handleSaveUnit} />
            </div>
            
        </div>
    );
}