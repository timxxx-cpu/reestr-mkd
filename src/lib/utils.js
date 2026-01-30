import { Building2, Store, Car, Box } from 'lucide-react';

/**
 * Генерирует список блоков для здания на основе его конфигурации.
 * Используется в BuildingConfigurator, EntranceMatrix, FloorMatrix и др.
 * @param {import('./types').BuildingMeta} building
 * @param {Object} [buildingDetails] - Детальные настройки (для получения кастомных адресов)
 */
export function getBlocksList(building, buildingDetails = {}) {
    if (!building) return [];
    const list = [];
    
    // Хелпер для формирования названия с номером дома
    const getLabelWithAddress = (baseLabel, fullId, defaultHouseNumber) => {
        const details = buildingDetails[fullId];
        // Если есть кастомный номер
        if (details?.hasCustomAddress && details?.customHouseNumber) {
            return `${baseLabel} (№${details.customHouseNumber})`;
        }
        // Иначе наследуем общий (для наглядности в многоблочных домах)
        return `${baseLabel} (№${defaultHouseNumber})`;
    };

    // 1. ЖИЛЫЕ БЛОКИ
    if (building.category && building.category.includes('residential')) {
        const count = building.resBlocks || (building.category === 'residential' ? 1 : 0);
        const isMultiblock = count > 1 || building.nonResBlocks > 0;

        for(let i=0; i < count; i++) {
            const fullId = `${building.id}_res_${i}`;
            const baseLabel = count > 1 ? `Жилой Блок ${i+1}` : `Жилой дом`;
            
            // Если блоков несколько, добавляем номер дома к названию
            const tabLabel = isMultiblock 
                ? getLabelWithAddress(baseLabel, fullId, building.houseNumber) 
                : baseLabel;

            list.push({ 
                id: `res_${i}`, 
                type: 'Ж', 
                index: i, 
                fullId: fullId,
                tabLabel: tabLabel,
                icon: Building2
            });
        }
    }

    // 2. НЕЖИЛЫЕ БЛОКИ
    if (building.nonResBlocks > 0) {
         for(let i=0; i < building.nonResBlocks; i++) {
             const fullId = `${building.id}_non_${i}`;
             const baseLabel = `Нежилой Блок ${i+1}`;
             
             // Для нежилых блоков в составе ЖК всегда показываем номер
             const tabLabel = getLabelWithAddress(baseLabel, fullId, building.houseNumber);

             list.push({ 
                 id: `non_${i}`, 
                 type: 'Н', 
                 index: i, 
                 fullId: fullId,
                 tabLabel: tabLabel,
                 icon: Store
             });
         }
    }

    // 3. СПЕЦИАЛЬНЫЕ ТИПЫ (Паркинги, Инфраструктура)
    if (building.category === 'parking_separate') {
         list.push({ 
             id: 'main', 
             type: 'Паркинг', 
             index: 0, 
             fullId: `${building.id}_main`,
             tabLabel: 'Паркинг',
             icon: Car 
        });
    } else if (building.category === 'infrastructure') {
         list.push({ 
             id: 'main', 
             type: 'Инфра', 
             index: 0, 
             fullId: `${building.id}_main`,
             tabLabel: building.infraType || 'Объект',
             icon: Box
        });
    }

    // Фолбек
    if (list.length === 0) {
        list.push({ 
            id: 'main', 
            type: 'Основной', 
            index: 0, 
            fullId: `${building.id}_main`,
            tabLabel: 'Основной корпус',
            icon: Building2
        });
    }
    
    return list;
}

/**
 * Расчет прогресса строительства в процентах по датам.
 */
export const calculateProgress = (start, end) => {
    if (!start || !end) return 0;
    const total = new Date(end).getTime() - new Date(start).getTime();
    const current = new Date().getTime() - new Date(start).getTime();
    if (total <= 0) return 0;
    const percent = (current / total) * 100;
    return Math.min(100, Math.max(0, percent));
};

/**
 * Возвращает CSS классы для бейджика статуса (Проектный, Строящийся и т.д.).
 */
export const getStageColor = (stage) => {
    switch(stage) {
        case 'Введенный': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'Строящийся': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Проектный': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'Архив': return 'bg-slate-100 text-slate-500 border-slate-200';
        default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
};