/**
 * @fileoverview Единый центр валидации данных проекта.
 * Содержит чистые функции для проверки значений.
 */

export const Validators = {
    /**
     * Проверка высоты потолка
     * @param {string} floorType - Тип этажа
     * @param {number|string} value - Значение
     * @returns {string|null} Текст ошибки или null
     */
    floorHeight: (floorType, value) => {
        const num = parseFloat(String(value));
        if (isNaN(num) && value !== '') return null;
        if (value === '' || value === null) return null;

        if (floorType === 'roof') {
            if (num < 0) return "Не меньше 0";
        } else {
            if (num < 1.8) return "Мин. 1.8 м";
        }
        if (num > 6.0) return "Макс. 6.0 м";
        return null;
    },

    /**
     * Проверка на положительное число
     * @param {number|string} value 
     * @returns {string|null} Текст ошибки или null
     */
    checkPositive: (value) => {
        const num = parseFloat(String(value));
        if (isNaN(num) || num <= 0) return "> 0";
        return null;
    },

    /**
     * Проверка расхождения площадей (> 15%)
     * @param {number|string} proj - Проектная площадь
     * @param {number|string} fact - Фактическая площадь
     * @returns {string|null} 'warning_diff' или null
     */
    checkDiff: (proj, fact) => {
        const p = parseFloat(String(proj));
        const f = parseFloat(String(fact));
        
        // Считаем разницу только если оба значения валидны (положительны)
        if (p > 0 && f > 0) {
            const diffPercent = Math.abs(p - f) / p * 100;
            if (diffPercent > 15) return "warning_diff";
        }
        return null;
    },

    /**
     * Проверка необходимости лифтов
     */
    elevatorRequirement: (isParking, isInfra, floorsCount, elevatorsCount) => {
        if (!isParking && !isInfra && floorsCount > 5) {
            return (elevatorsCount || 0) < 1;
        }
        return false;
    },

    /**
     * Проверка наличия коммерческих помещений
     */
    commercialPresence: (building, buildingDetails, blocksList, mode) => {
        if (mode === 'nonres') return true; 
        if (!building.hasNonResPart) return true; 
        
        const isParking = building.category === 'parking_separate';
        const isInfra = building.category === 'infrastructure';
        if (isParking || isInfra) return true;

        const residentialBlockIds = blocksList.filter(b => b.type === 'Ж');
        
        const hasAnyCommercial = residentialBlockIds.some(block => {
            const key = `${building.id}_${block.id}`;
            const details = buildingDetails[key];
            return details?.commercialFloors?.length > 0;
        });

        return hasAnyCommercial;
    },

    /**
     * Валидация записи МОП
     */
    isMopValid: (mop) => {
        return mop && mop.type && mop.area && parseFloat(String(mop.area)) > 0;
    },

    /**
     * Проверка возможности создания дуплекса
     */
    checkDuplexAvailability: (currentFloor, nextFloor, hasApartments) => {
        if (!['residential', 'mixed'].includes(currentFloor.type)) {
            return { disabled: true, title: 'Только на жилых/смешанных этажах' };
        }
        if (!hasApartments) {
            return { disabled: true, title: 'Введите количество квартир' };
        }
        if (!nextFloor) {
            return { disabled: true, title: 'Нет этажа сверху для второго уровня' };
        }
        if (nextFloor.type === 'technical') {
            return { disabled: true, title: 'Нельзя объединить с техническим этажом' };
        }
        return { disabled: false, title: 'Объединить с этажом выше' };
    },

    /**
     * [NEW] Проверка доступности поля ввода (квартиры/офисы) на этаже
     * @param {Object} floor - Объект этажа из floorList
     * @param {string} field - Поле ('apts' | 'units' | 'mopQty')
     * @param {boolean} isUnderground - Флаг подземного сооружения
     */
    checkFieldAvailability: (floor, field, isUnderground) => {
        if (field === 'mopQty') return true; 
        if (isUnderground) return false; 
        
        if (field === 'apts') {
            return ['residential', 'mixed', 'basement', 'tsokol', 'attic'].includes(floor.type);
        }
        
        if (field === 'units') {
            return floor.isComm; // Флаг, который проставляет useBuildingFloors
        }
        
        return true;
    }
};