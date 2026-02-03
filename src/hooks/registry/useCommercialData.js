import { useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { getBlocksList } from '../../lib/utils';

export function useCommercialData() {
    const { 
        composition, flatMatrix, floorData, 
        entrancesData, buildingDetails, complexInfo 
    } = useProject();

    const [filters, setFilters] = useState({
        building: 'all',
        floor: 'all',
        status: 'all'
    });
    const [searchTerm, setSearchTerm] = useState('');

    const resolveFloorLabel = (buildingId, floorId) => {
        if (!floorId) return '-';
        const entry = Object.values(floorData).find(f => f.id === floorId && f.buildingId === buildingId);
        if (entry) return entry.label;
        if (floorId.includes('floor_')) return `${floorId.replace('floor_', '')} этаж`;
        if (floorId.includes('base_')) return 'Подвал';
        if (floorId === 'tsokol') return 'Цоколь';
        if (!isNaN(parseInt(floorId))) return `${floorId} этаж`;
        return '-';
    };

    const allObjects = useMemo(() => {
        const list = [];
        const registeredUnits = new Set(); // Для исключения дублей

        // Хелпер добавления в индекс
        const addToIndex = (bId, blId, ent, num) => {
            registeredUnits.add(`${bId}_${blId}_${ent}_${num}`);
        };
        const isRegistered = (bId, blId, ent, num) => registeredUnits.has(`${bId}_${blId}_${ent}_${num}`);

        composition.forEach(building => {
            const blocks = getBlocksList(building, buildingDetails);

            // 1. Сбор СОХРАНЕННЫХ коммерческих объектов (офисы, кладовки)
            Object.keys(flatMatrix).forEach(key => {
                if (!key.startsWith(building.id)) return;
                const unit = flatMatrix[key];
                if (!unit || !unit.num) return;

                // Фильтр типов
                if (!['office', 'office_inventory', 'non_res_block', 'infrastructure', 'pantry'].includes(unit.type)) return;

                // Парсинг (аналогично квартирам)
                let { entrance, floorId, blockId } = unit;
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

                const item = {
                    ...unit,
                    id: key,
                    uuid: unit.id,
                    buildingId: building.id,
                    blockId, floorId,
                    houseNumber: building.houseNumber,
                    buildingLabel: building.label,
                    number: unit.num,
                    area: unit.area || '0',
                    blockLabel, floorLabel,
                    entrance: entrance || '-',
                    isSaved: true
                };

                list.push(item);
                if (blockId && entrance && unit.num) {
                    addToIndex(building.id, blockId, entrance, unit.num);
                }
            });

            // 2. Генерация ВИРТУАЛЬНЫХ объектов
            // А. Из шахматки (Жилые блоки с коммерцией)
            const resBlocks = blocks.filter(b => b.type === 'Ж');
            resBlocks.forEach(block => {
                Object.keys(entrancesData).forEach(entKey => {
                    if (!entKey.startsWith(block.fullId)) return;
                    
                    const data = entrancesData[entKey];
                    const unitsCount = parseInt(data.units || 0);
                    
                    if (unitsCount > 0) {
                        const entMatch = entKey.match(/_ent(\d+)_(.*)$/);
                        if (entMatch) {
                            const entIdx = entMatch[1];
                            const floorId = entMatch[2];
                            const floorLabel = resolveFloorLabel(building.id, floorId);

                            for(let i = 1; i <= unitsCount; i++) {
                                const candidateNumber = `НП-${i}`;
                                // Если такой уже есть в сохраненных — пропускаем
                                if (isRegistered(building.id, block.id, entIdx, candidateNumber)) continue;

                                list.push({
                                    id: `${entKey}_unit_${i}`, // Временный ID
                                    buildingId: building.id,
                                    blockId: block.id,
                                    floorId: floorId,
                                    houseNumber: building.houseNumber,
                                    buildingLabel: building.label,
                                    address: complexInfo?.street,
                                    number: candidateNumber,
                                    type: 'office_inventory',
                                    area: '0',
                                    blockLabel: block.tabLabel,
                                    floorLabel: floorLabel,
                                    entrance: entIdx,
                                    isSaved: false 
                                });
                            }
                        }
                    }
                });
            });

            // Б. Нежилые блоки (Целиком)
            const nonResBlocks = blocks.filter(b => b.type === 'Н');
            nonResBlocks.forEach(block => {
                const virtualId = `${building.id}_${block.id}_whole`;
                // Проверяем, не сохранен ли уже этот блок как юнит
                // Тут сложнее, так как у него может быть произвольный номер.
                // Но обычно нежилые блоки сохраняются с типом 'non_res_block'.
                // Упрощение: если в списке уже есть non_res_block для этого blockId, не добавляем.
                const exists = list.some(l => l.buildingId === building.id && l.blockId === block.id && l.type === 'non_res_block' && l.isSaved);
                
                if (!exists) {
                    let totalArea = 0;
                    Object.entries(floorData).forEach(([k, v]) => {
                        if (k.startsWith(`${building.id}_${block.id}`)) totalArea += (parseFloat(v.areaProj) || 0);
                    });

                    list.push({
                        id: virtualId,
                        buildingId: building.id,
                        blockId: block.id,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        number: block.tabLabel,
                        type: 'non_res_block',
                        area: totalArea.toFixed(2),
                        blockLabel: block.tabLabel,
                        floorLabel: 'Все этажи',
                        entrance: '-',
                        isSaved: false
                    });
                }
            });

            // В. Инфраструктура
            if (building.category === 'infrastructure') {
                // Если для этого здания еще нет юнитов
                const exists = list.some(l => l.buildingId === building.id && l.type === 'infrastructure' && l.isSaved);
                if (!exists) {
                    let infraArea = 0;
                    Object.entries(floorData).forEach(([k, v]) => {
                        if (k.startsWith(`${building.id}_main`)) infraArea += (parseFloat(v.areaProj) || 0);
                    });
                    
                    list.push({
                        id: `${building.id}_infra_virtual`,
                        buildingId: building.id,
                        houseNumber: building.houseNumber,
                        buildingLabel: building.label,
                        number: building.infraType || 'Инфра',
                        type: 'infrastructure',
                        area: infraArea.toFixed(2),
                        blockLabel: '-',
                        floorLabel: 'Все этажи',
                        entrance: '-',
                        isSaved: false
                    });
                }
            }
        });

        return list.sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
    }, [composition, flatMatrix, entrancesData, floorData, buildingDetails, complexInfo]);

    const filteredData = useMemo(() => {
        return allObjects.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = String(item.number).toLowerCase().includes(searchLower) || 
                                  String(item.houseNumber).toLowerCase().includes(searchLower);
            
            const matchesBuilding = filters.building === 'all' || item.buildingId === filters.building;
            const matchesFloor = filters.floor === 'all' || item.floorLabel === filters.floor;

            let matchesStatus = true;
            if (filters.status !== 'all') {
                const isFilled = parseFloat(item.area) > 0;
                if (filters.status === 'Готов') matchesStatus = isFilled;
                else if (filters.status === 'Не готов') matchesStatus = !isFilled;
            }

            return matchesSearch && matchesBuilding && matchesFloor && matchesStatus;
        });
    }, [allObjects, searchTerm, filters]);

    const options = useMemo(() => {
        const contextData = filters.building === 'all' ? allObjects : allObjects.filter(d => d.buildingId === filters.building);
        return {
            floors: [...new Set(contextData.map(d => d.floorLabel).filter(f => f && f !== '-'))].sort()
        };
    }, [allObjects, filters.building]);

    const stats = useMemo(() => ({
        total: filteredData.length,
        totalArea: filteredData.reduce((acc, item) => acc + (parseFloat(item.area) || 0), 0)
    }), [filteredData]);

    return { data: filteredData, stats, options, filters, setFilters, searchTerm, setSearchTerm };
}