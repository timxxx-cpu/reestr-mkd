import { useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';

export function useParkingData() {
    const { composition, parkingPlaces, floorData } = useProject();

    const [filters, setFilters] = useState({
        building: 'all',
        floor: 'all', // Уровень
        status: 'all'
    });
    const [searchTerm, setSearchTerm] = useState('');

    const resolveFloorLabel = (buildingId, floorId) => {
        if (!floorId) return '-';
        // Попытка найти во floorData
        const entry = Object.values(floorData).find(f => f.id === floorId && f.buildingId === buildingId);
        if (entry) return entry.label;

        // Парсинг ключа
        if (floorId.includes('level_minus')) return `Уровень -${floorId.split('_')[2]}`;
        if (floorId.includes('floor_')) return `${floorId.split('_')[1]} этаж`;
        if (floorId.includes('base_')) {
             const m = floorId.match(/_L(\d+)/);
             return m ? `Подвал -${m[1]}` : 'Подвал';
        }
        return floorId;
    };

    const allObjects = useMemo(() => {
        const list = [];
        
        composition.forEach(building => {
            Object.keys(parkingPlaces).forEach(key => {
                // Фильтр: ключ должен относиться к зданию и быть местом (не мета-данными)
                if (!key.startsWith(building.id) || !key.includes('_place')) return;
                
                const place = parkingPlaces[key];
                
                // Извлечение floorId из ключа
                // Ключи паркинга: {blockFullId}_{floorId}_place{i}
                // blockFullId = {buildingId}_{blockId}
                // Пример: b1_main_level_minus_1_place0
                
                let floorId = null;
                if (key.includes('level_minus_')) {
                    const parts = key.split('level_minus_');
                    // parts[1] starts with "1_place0"
                    const levelNum = parts[1].split('_')[0];
                    floorId = `level_minus_${levelNum}`;
                }
                else if (key.includes('_floor_')) {
                    const parts = key.split('_floor_');
                    const floorNum = parts[1].split('_')[0];
                    floorId = `floor_${floorNum}`;
                }
                else if (key.includes('_base_')) {
                     // b1_res_0_base_xxx_L1_place0
                     const m = key.match(/(base_.*_L\d+)_place/);
                     if (m) floorId = m[1];
                }

                const floorLabel = resolveFloorLabel(building.id, floorId) || 'Уровень';

                list.push({
                    ...place,
                    id: key,
                    uuid: place.id,
                    buildingId: building.id,
                    houseNumber: building.houseNumber,
                    buildingLabel: building.label,
                    floorLabel: floorLabel,
                    floorId: floorId,
                    number: place.number,
                    area: place.area || '13.25',
                    isSold: place.isSold || false,
                    isSaved: true
                });
            });
        });

        return list.sort((a, b) => {
            const numA = parseInt(a.number);
            const numB = parseInt(b.number);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.number.localeCompare(b.number);
        });
    }, [composition, parkingPlaces, floorData]);

    const filteredData = useMemo(() => {
        return allObjects.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = String(item.number).toLowerCase().includes(searchLower);
            
            const matchesBuilding = filters.building === 'all' || item.buildingId === filters.building;
            const matchesFloor = filters.floor === 'all' || item.floorLabel === filters.floor;

            let matchesStatus = true;
            if (filters.status !== 'all') {
                if (filters.status === 'Свободно') matchesStatus = !item.isSold;
                else if (filters.status === 'Продано') matchesStatus = item.isSold;
            }

            return matchesSearch && matchesBuilding && matchesFloor && matchesStatus;
        });
    }, [allObjects, searchTerm, filters]);

    const options = useMemo(() => {
        const contextData = filters.building === 'all' ? allObjects : allObjects.filter(d => d.buildingId === filters.building);
        return {
            floors: [...new Set(contextData.map(d => d.floorLabel))].sort()
        };
    }, [allObjects, filters.building]);

    const stats = useMemo(() => ({
        total: filteredData.length,
        free: filteredData.filter(i => !i.isSold).length,
        totalArea: filteredData.reduce((acc, item) => acc + (parseFloat(item.area) || 0), 0)
    }), [filteredData]);

    return { data: filteredData, stats, options, filters, setFilters, searchTerm, setSearchTerm };
}