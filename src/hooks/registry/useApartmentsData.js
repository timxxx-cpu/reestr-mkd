import { useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { getBlocksList } from '../../lib/utils';

export function useApartmentsData() {
    const { 
        composition, flatMatrix, floorData, 
        buildingDetails, complexInfo 
    } = useProject();

    const [filters, setFilters] = useState({
        building: 'all',
        entrance: 'all',
        floor: 'all',
        status: 'all'
    });

    const [searchTerm, setSearchTerm] = useState('');

    // Хелпер для названия этажа
    const resolveFloorLabel = (buildingId, floorId) => {
        if (!floorId) return '-';
        const entry = Object.values(floorData).find(f => f.id === floorId && f.buildingId === buildingId);
        if (entry) return entry.label;

        if (floorId.includes('floor_')) return `${floorId.replace('floor_', '')} этаж`;
        if (floorId.includes('minus')) return `Уровень -${floorId.split('minus_')[1]}`;
        if (floorId.includes('base_')) return 'Подвал';
        if (floorId === 'attic') return 'Мансарда';
        if (floorId === 'tsokol') return 'Цоколь';
        if (!isNaN(parseInt(floorId))) return `${floorId} этаж`;
        return '-';
    };

    const allObjects = useMemo(() => {
        const list = [];
        
        composition.forEach(building => {
            if (!building.category.includes('residential')) return;

            const blocks = getBlocksList(building, buildingDetails);

            Object.keys(flatMatrix).forEach(key => {
                if (!key.startsWith(building.id)) return;
                
                const unit = flatMatrix[key];
                if (!unit || !unit.num) return; 

                // Фильтр: только жилые
                if (!['flat', 'duplex_up', 'duplex_down'].includes(unit.type)) return;

                let { entrance, floorId, blockId } = unit;

                // Парсинг ключа, если данных нет в объекте
                if (!floorId || !entrance || !blockId) {
                    const match = key.match(/_e(\d+)_f(.*)_i(\d+)/);
                    if (match) {
                        if (!entrance) entrance = match[1];
                        if (!floorId) floorId = match[2];
                        if (!blockId) {
                            const suffixIndex = key.indexOf(`_e${entrance}_f`);
                            if (suffixIndex > -1) {
                                const prefix = key.substring(0, suffixIndex);
                                if (prefix.startsWith(building.id + '_')) {
                                    blockId = prefix.substring(building.id.length + 1);
                                }
                            }
                        }
                    }
                }
                if (floorId && floorId.startsWith('_')) floorId = floorId.substring(1);

                const floorLabel = resolveFloorLabel(building.id, floorId);
                let blockLabel = unit.blockLabel || 'Секция';
                if (blockId) {
                    const bObj = blocks.find(b => b.id === blockId);
                    if (bObj) blockLabel = bObj.tabLabel;
                }

                list.push({
                    ...unit,
                    id: key, 
                    uuid: unit.id || (key.length > 30 ? key : null),
                    buildingId: building.id,
                    blockId: blockId,
                    floorId: floorId,
                    houseNumber: building.houseNumber,
                    buildingLabel: building.label,
                    address: complexInfo?.street,
                    
                    number: unit.num,
                    // Гарантируем строки для UI
                    area: unit.area || '0',           
                    livingArea: unit.livingArea || '0', 
                    usefulArea: unit.usefulArea || '0', 
                    
                    blockLabel: blockLabel,
                    floorLabel: floorLabel,
                    entrance: entrance || '-',
                    isSaved: true 
                });
            });
        });

        return list.sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
    }, [composition, flatMatrix, floorData, buildingDetails, complexInfo]);

    // Фильтрация
    const filteredData = useMemo(() => {
        return allObjects.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = String(item.number).toLowerCase().includes(searchLower) || 
                                  String(item.houseNumber).toLowerCase().includes(searchLower);
            
            const matchesBuilding = filters.building === 'all' || item.buildingId === filters.building;
            const matchesEntrance = filters.entrance === 'all' || String(item.entrance) === String(filters.entrance);
            const matchesFloor = filters.floor === 'all' || item.floorLabel === filters.floor;

            let matchesStatus = true;
            if (filters.status !== 'all') {
                const isFilled = parseFloat(item.area) > 0;
                if (filters.status === 'Готов') matchesStatus = isFilled;
                else if (filters.status === 'Не готов') matchesStatus = !isFilled;
            }

            return matchesSearch && matchesBuilding && matchesEntrance && matchesFloor && matchesStatus;
        });
    }, [allObjects, searchTerm, filters]);

    // Опции для селектов
    const options = useMemo(() => {
        const contextData = filters.building === 'all' 
            ? allObjects 
            : allObjects.filter(d => d.buildingId === filters.building);

        return {
            entrances: [...new Set(contextData.map(d => d.entrance).filter(e => e && e !== '-'))]
                .sort((a, b) => parseInt(a) - parseInt(b)),
            floors: [...new Set(contextData.map(d => d.floorLabel).filter(f => f && f !== '-'))]
                .sort((a, b) => parseInt(a) - parseInt(b))
        };
    }, [allObjects, filters.building]);

    // Статистика
    const stats = useMemo(() => {
        return {
            total: filteredData.length,
            totalArea: filteredData.reduce((acc, item) => acc + (parseFloat(item.area) || 0), 0)
        };
    }, [filteredData]);

    return {
        data: filteredData,
        stats,
        options,
        filters,
        setFilters,
        searchTerm,
        setSearchTerm
    };
}