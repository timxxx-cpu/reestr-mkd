import { useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { getBlocksList } from '../lib/utils';
import { buildFloorList } from '../lib/floor-utils';

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

    const floorList = useMemo(() => buildFloorList(building, currentBlock, buildingDetails), [building, currentBlock, buildingDetails]);

    return { 
        floorList, 
        currentBlock,
        isUndergroundParking: building?.category === 'parking_separate' && building?.parkingType === 'underground',
        isParking: building?.category === 'parking_separate',
        isInfrastructure: building?.category === 'infrastructure'
    };
}
