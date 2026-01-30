import { useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { getBlocksList } from '../lib/utils';

/**
 * Хук для генерации списка этажей здания.
 * Учитывает: тип здания, подвалы, цоколь, тех. этажи, стилобат, коммерцию.
 */
export function useBuildingFloors(buildingId, activeBlockId = 0) {
    const { composition, buildingDetails } = useProject();

    const building = useMemo(() => composition.find(c => c.id === buildingId), [composition, buildingId]);
    
    // Определяем текущий блок
    const currentBlock = useMemo(() => {
        if (!building) return null;
        const blocks = getBlocksList(building, buildingDetails);
        
        if (typeof activeBlockId === 'number') {
            return blocks[activeBlockId];
        }
        return blocks.find(b => b.id === activeBlockId) || blocks[0];
    }, [building, activeBlockId, buildingDetails]);

    const floorList = useMemo(() => {
        if (!building || !currentBlock) return [];
        const list = [];
        const detailsKey = `${building.id}_${currentBlock.id}`;
        
        const effectiveDetailsKey = (building.category === 'parking_separate' || building.category === 'infrastructure') 
            ? `${building.id}_main` 
            : detailsKey;

        // @ts-ignore
        const blockDetails = buildingDetails[effectiveDetailsKey] || {};
        const features = /** @type {any} */ (buildingDetails[`${building.id}_features`] || {});
        const basements = features.basements || [];
        const commFloors = blockDetails.commercialFloors || [];

        // --- Тип: Подземный паркинг ---
        const isUndergroundParking = building.category === 'parking_separate' && building.parkingType === 'underground';
        if (isUndergroundParking) {
            const depth = Number(blockDetails.levelsDepth || 1);
            for (let i = 1; i <= depth; i++) {
                list.push({
                    id: `level_minus_${i}`,
                    label: `Уровень -${i}`,
                    type: 'parking_floor',
                    index: -i,
                    isComm: false,
                    sortOrder: -i 
                });
            }
            return list.sort((a, b) => b.sortOrder - a.sortOrder);
        }

        // --- Тип: Наземный объект ---
        
        // 1. Подвалы
        const currentBlockBasements = basements.filter(b => b.blocks?.includes(currentBlock.id));
        const hasMultipleBasements = currentBlockBasements.length > 1;

        currentBlockBasements.forEach((b, bIdx) => {
            const depth = Number(b.depth || 1);
            const isThisBasementMixed = commFloors.includes(`basement_${b.id}`) || commFloors.includes('basement');

            for (let d = depth; d >= 1; d--) {
                let label = `Подвал (этаж -${d})`;
                if (hasMultipleBasements) label = `Подвал ${bIdx + 1} (этаж -${d})`;

                list.push({
                    id: `base_${b.id}_L${d}`,
                    label: label,
                    type: 'basement',
                    isComm: isThisBasementMixed,
                    isSeparator: d === 1,
                    sortOrder: -1000 - d + (Number(bIdx) * 0.1)
                });
            }
        });

        // 2. Цоколь
        if (blockDetails.hasBasementFloor) {
            const isTsokolMixed = commFloors.includes('tsokol');
            list.push({ 
                id: 'floor_0', 
                label: 'Цокольный этаж', 
                type: 'tsokol', 
                isComm: isTsokolMixed,
                isSeparator: true, 
                sortOrder: 0 
            });
        }

        // 3. Стилобат (Карта перекрытий)
        // Создаем карту: номер этажа -> название нежилого блока, который находится под текущим жилым
        const stylobateMap = {}; 
        if (currentBlock.type === 'Ж') {
            const allBlocks = getBlocksList(building, buildingDetails); 
            allBlocks.forEach(b => {
                if (b.type === 'Н') { // Нежилой блок
                    // @ts-ignore
                    const bDetails = buildingDetails[`${building.id}_${b.id}`];
                    // Если этот нежилой блок указан как родитель для текущего жилого
                    if (bDetails?.parentBlocks?.includes(currentBlock.id)) {
                        const h = Number(bDetails.floorsTo || 0);
                        // Заполняем карту для всех этажей, которые занимает этот нежилой блок
                        for(let k = 1; k <= h; k++) {
                            stylobateMap[k] = b.tabLabel; // Сохраняем имя блока
                        }
                    }
                }
            });
        }

        // 4. Основные этажи
        let start = 1;
        let end = 1;

        if (building.category === 'parking_separate' || building.category === 'infrastructure') {
            start = 1;
            end = Number(blockDetails.floorsCount || 1);
        } else {
            start = Number(blockDetails.floorsFrom || 1);
            end = Number(blockDetails.floorsTo || 1);
        }

        for (let i = start; i <= end; i++) {
            // Проверка: является ли этаж частью стилобата
            const stylobateSource = stylobateMap[i];
            
            if (stylobateSource) {
                // Это этаж стилобата (нежилого блока под низом)
                list.push({
                    id: `floor_${i}`,
                    label: `${i} этаж`,
                    index: i,
                    type: 'stylobate', // Новый тип!
                    isStylobate: true,
                    stylobateLabel: stylobateSource, // Название блока-источника
                    isComm: true, // Стилобат обычно коммерческий, поля доступны
                    sortOrder: i * 10
                });
            } else {
                // Обычный этаж
                let type = 'residential';
                if (currentBlock.type === 'Н') type = 'office';
                if (building.category === 'parking_separate') type = 'parking_floor';
                if (building.category === 'infrastructure') type = 'office';
                
                const isMixed = commFloors.includes(i);
                if (currentBlock.type === 'Ж' && isMixed) type = 'mixed';

                list.push({
                    id: `floor_${i}`,
                    label: `${i} этаж`,
                    index: i,
                    type: type,
                    isComm: isMixed || type === 'office',
                    sortOrder: i * 10
                });
            }

            // Вставка тех. этажей
            if (blockDetails.technicalFloors?.includes(i)) {
                const isTechMixed = commFloors.includes(`${i}-Т`);
                list.push({
                    id: `floor_${i}_tech`,
                    label: `${i}-Т (Технический)`,
                    type: 'technical',
                    isComm: isTechMixed,
                    isInserted: true, 
                    sortOrder: (i * 10) + 5
                });
            }
        }

        // 5. Верхние спец. этажи
        // @ts-ignore
        const extraTechs = (blockDetails.technicalFloors || []).filter(f => Number(f) > end);
        // @ts-ignore
        extraTechs.forEach(f => {
             list.push({ 
                 id: `floor_${f}_tech_extra`, 
                 label: `${f} (Тех)`, 
                 type: 'technical', 
                 isComm: false, 
                 sortOrder: Number(f) * 10 
            });
        });

        if (blockDetails.hasAttic) {
            const isAtticMixed = commFloors.includes('attic');
            list.push({ id: 'attic', label: 'Мансарда', type: 'attic', isComm: isAtticMixed, sortOrder: 50000 });
        }
        if (blockDetails.hasLoft) {
            const isLoftMixed = commFloors.includes('loft');
            list.push({ id: 'loft', label: 'Чердак', type: 'loft', isComm: isLoftMixed, sortOrder: 55000 });
        }
        if (blockDetails.hasExploitableRoof) {
            const isRoofMixed = commFloors.includes('roof');
            list.push({ id: 'roof', label: 'Эксплуатируемая кровля', type: 'roof', isComm: isRoofMixed, sortOrder: 60000 });
        }

        return list.sort((a, b) => a.sortOrder - b.sortOrder);

    }, [building, currentBlock, buildingDetails]);

    return { 
        floorList, 
        currentBlock,
        isUndergroundParking: building?.category === 'parking_separate' && building?.parkingType === 'underground',
        isParking: building?.category === 'parking_separate',
        isInfrastructure: building?.category === 'infrastructure'
    };
}