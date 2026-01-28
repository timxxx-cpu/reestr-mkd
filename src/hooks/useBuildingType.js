import { useMemo } from 'react';

/**
 * Хук для определения типа и характеристик здания.
 * Централизует логику проверки категорий (Паркинг, Жилье, Инфра и т.д.)
 * @param {import('../lib/types').BuildingMeta} building
 */
export function useBuildingType(building) {
    return useMemo(() => {
        if (!building) return {};

        const isParking = building.category === 'parking_separate';
        const isInfrastructure = building.category === 'infrastructure';
        // Охватывает и 'residential', и 'residential_multiblock'
        const isResidential = building.category?.includes('residential'); 

        const isUnderground = isParking && building.parkingType === 'underground';
        const constructionType = building.constructionType || 'capital';
        
        // Виды наземных паркингов
        const isGroundCapital = isParking && !isUnderground && constructionType === 'capital';
        const isGroundLight = isParking && !isUnderground && constructionType === 'light';
        const isGroundOpen = isParking && !isUnderground && constructionType === 'open';
        
        // Капитальное строение (для которого нужны стены, фундамент и т.д.)
        const isCapitalStructure = isUnderground || isGroundCapital;

        return {
            isParking,
            isInfrastructure,
            isResidential,
            isUnderground,
            constructionType,
            isGroundCapital,
            isGroundLight,
            isGroundOpen,
            isCapitalStructure
        };
    }, [building]);
}