import { useMemo, useState, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';

export function useParkingData() {
    const { composition, parkingPlaces, floorData } = useProject();

    const [filters, setFilters] = useState({ building: 'all', floor: 'all', status: 'all' });
    const [searchTerm, setSearchTerm] = useState('');

    const resolveFloorLabel = useCallback((buildingId, floorId) => {
        if (!floorId) return '-';
        const entry = Object.values(floorData).find(f => f.id === floorId); // [FIX] Ищем по ID
        if (entry) return entry.label;
        if (floorId.includes('level_minus')) return `Уровень -${floorId.split('_')[2]}`;
        return floorId;
    }, [floorData]);

    const allObjects = useMemo(() => {
        const list = [];
        
        composition.forEach(building => {
            Object.keys(parkingPlaces).forEach(key => {
                const place = parkingPlaces[key];
                
                // [FIX] Проверяем buildingId внутри объекта
                if (place.buildingId !== building.id) return;
                
                // Фильтруем мета-данные (count, enabled), оставляем только сами места
                if (!place.number) return; 

                const floorLabel = resolveFloorLabel(building.id, place.floorId) || 'Уровень';

                list.push({
                    ...place,
                    id: key,
                    uuid: place.id,
                    buildingId: building.id,
                    houseNumber: building.houseNumber,
                    buildingLabel: building.label,
                    floorLabel: floorLabel,
                    floorId: place.floorId,
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
    }, [composition, parkingPlaces, resolveFloorLabel]);

    // ... код фильтрации без изменений
    const filteredData = useMemo(() => {
        return allObjects.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = String(item.number).toLowerCase().includes(searchLower);
            const matchesBuilding = filters.building === 'all' || item.buildingId === filters.building;
            const matchesFloor = filters.floor === 'all' || item.floorLabel === filters.floor;
            return matchesSearch && matchesBuilding && matchesFloor;
        });
    }, [allObjects, searchTerm, filters]);

    const options = useMemo(() => {
        const contextData = filters.building === 'all' ? allObjects : allObjects.filter(d => d.buildingId === filters.building);
        return { floors: [...new Set(contextData.map(d => d.floorLabel))].sort() };
    }, [allObjects, filters.building]);

    const stats = useMemo(() => ({
        total: filteredData.length,
        free: filteredData.filter(i => !i.isSold).length,
        totalArea: filteredData.reduce((acc, item) => acc + (parseFloat(item.area) || 0), 0)
    }), [filteredData]);

    return { data: filteredData, stats, options, filters, setFilters, searchTerm, setSearchTerm };
}