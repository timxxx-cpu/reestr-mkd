import React, { useState, useMemo } from 'react';
import { useProject } from '../../../context/ProjectContext'; // 3 уровня вверх от index.jsx
import { useBuildingType } from '../../../hooks/useBuildingType';

import ConfigHeader from './ConfigHeader'; // Лежит рядом
// Импорты из папки views
import StandardView from './views/StandardView'; 
import ParkingView from './views/ParkingView';
import InfrastructureView from './views/InfrastructureView';

export default function BuildingConfiguratorIndex({ buildingId, mode = 'all', onBack }) {
    const { composition } = useProject();
    
    // 1. Находим здание
    const building = useMemo(() => composition.find(c => c.id === buildingId), [composition, buildingId]);
    
    // 2. Определяем тип
    const typeInfo = useBuildingType(building);
    
    // 3. Если здания нет (удалено или ошибка)
    if (!building) return <div className="p-8 text-center">Объект не найден</div>;

    const { isParking, isInfrastructure } = typeInfo;

    return (
        <div className="animate-in slide-in-from-bottom duration-500 space-y-6 pb-20 max-w-7xl mx-auto w-full">
            {/* Общая шапка */}
            <ConfigHeader 
                building={building} 
                isParking={isParking} 
                isInfrastructure={isInfrastructure}
                isUnderground={typeInfo.isUnderground} 
                onBack={onBack} 
            />

            {/* Роутинг по типу здания */}
            {isParking ? (
                <ParkingView building={building} typeInfo={typeInfo} />
            ) : isInfrastructure ? (
                <InfrastructureView building={building} />
            ) : (
                <StandardView building={building} mode={mode} />
            )}
        </div>
    );
}