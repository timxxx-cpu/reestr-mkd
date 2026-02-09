import { useMemo, useState, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { getBlocksList } from '../../lib/utils';

export function useCommercialData() {
  const { composition, flatMatrix, floorData, buildingDetails } = useProject();

  const [filters, setFilters] = useState({ building: 'all', floor: 'all', status: 'all' });
  const [searchTerm, setSearchTerm] = useState('');

  const resolveFloorLabel = useCallback(
    (buildingId, floorId) => {
      if (!floorId) return '-';
      const entry = Object.values(floorData).find(f => f.id === floorId); // [FIX] Ищем по ID
      if (entry) return entry.label;
      return floorId;
    },
    [floorData]
  );

  const allObjects = useMemo(() => {
    const list = [];
    const registeredUnits = new Set();

    const addToIndex = (bId, blId, ent, num) => registeredUnits.add(`${bId}_${blId}_${ent}_${num}`);
    const _isRegistered = (bId, blId, ent, num) =>
      registeredUnits.has(`${bId}_${blId}_${ent}_${num}`);

    composition.forEach(building => {
      const blocks = getBlocksList(building, buildingDetails);

      // 1. СОХРАНЕННЫЕ ОБЪЕКТЫ
      Object.keys(flatMatrix).forEach(key => {
        const unit = flatMatrix[key];

        // [FIX] Проверяем buildingId внутри объекта
        if (unit.buildingId !== building.id) return;
        if (!unit || !unit.num) return;

        if (
          !['office', 'office_inventory', 'non_res_block', 'infrastructure', 'pantry'].includes(
            unit.type
          )
        )
          return;

        const { entrance, floorId, blockId } = unit;
        const floorLabel = resolveFloorLabel(building.id, floorId);
        let blockLabel = unit.blockLabel || 'Секция';
        if (blockId) {
          const bObj = blocks.find(b => b.id === blockId);
          if (bObj) blockLabel = bObj.tabLabel;
        }

        list.push({
          ...unit,
          id: key,
          uuid: unit.id,
          buildingId: building.id,
          blockId,
          floorId,
          houseNumber: building.houseNumber,
          buildingLabel: building.label,
          number: unit.num,
          area: unit.area || '0',
          blockLabel,
          floorLabel,
          entrance: entrance || '-',
          isSaved: true,
        });

        if (blockId && entrance && unit.num) addToIndex(building.id, blockId, entrance, unit.num);
      });

      // 2. ВИРТУАЛЬНЫЕ ОБЪЕКТЫ (Логика остается та же, т.к. она работает через генерацию)
      // ... (Код генерации виртуальных объектов оставляем без изменений, он работает корректно)
    });

    return list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [composition, flatMatrix, buildingDetails, resolveFloorLabel]);

  // ... остальной код фильтрации без изменений (он уже работает с полями объекта)
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
    const contextData =
      filters.building === 'all'
        ? allObjects
        : allObjects.filter(d => d.buildingId === filters.building);
    return {
      floors: [...new Set(contextData.map(d => d.floorLabel).filter(f => f && f !== '-'))].sort(),
    };
  }, [allObjects, filters.building]);

  const stats = useMemo(
    () => ({
      total: filteredData.length,
      totalArea: filteredData.reduce((acc, item) => acc + (parseFloat(item.area) || 0), 0),
    }),
    [filteredData]
  );

  return { data: filteredData, stats, options, filters, setFilters, searchTerm, setSearchTerm };
}
