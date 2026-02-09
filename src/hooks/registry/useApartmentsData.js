import { useMemo, useState, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { getBlocksList } from '../../lib/utils';

export function useApartmentsData() {
  const { composition, flatMatrix, floorData, buildingDetails, complexInfo } = useProject();

  const [filters, setFilters] = useState({
    building: 'all',
    entrance: 'all',
    floor: 'all',
    status: 'all',
  });

  const [searchTerm, setSearchTerm] = useState('');

  const resolveFloorLabel = useCallback(
    (buildingId, floorId) => {
      if (!floorId) return '-';
      // Ищем этаж по ID, игнорируя префикс ключа
      const entry = Object.values(floorData).find(f => f.id === floorId);
      if (entry) return entry.label;
      return floorId; // Fallback
    },
    [floorData]
  );

  const allObjects = useMemo(() => {
    const list = [];

    composition.forEach(building => {
      if (!building.category.includes('residential')) return;

      const blocks = getBlocksList(building, buildingDetails);

      Object.keys(flatMatrix).forEach(key => {
        const unit = flatMatrix[key];

        // [FIX] Проверяем buildingId внутри объекта, а не по ключу
        if (unit.buildingId !== building.id) return;
        if (!unit || !unit.num) return;

        // Фильтр: только жилые
        if (!['flat', 'duplex_up', 'duplex_down'].includes(unit.type)) return;

        // Парсинг (если данных нет в объекте, но они есть в ключе - старая логика, оставляем как fallback)
        let { entrance, floorId, blockId } = unit;

        const floorLabel = resolveFloorLabel(building.id, floorId);
        let blockLabel = unit.blockLabel || 'Секция';
        if (blockId) {
          const bObj = blocks.find(b => b.id === blockId);
          if (bObj) blockLabel = bObj.tabLabel;
        }

        list.push({
          ...unit,
          id: key,
          uuid: unit.id || key,
          buildingId: building.id,
          blockId: blockId,
          floorId: floorId,
          houseNumber: building.houseNumber,
          buildingLabel: building.label,
          address: complexInfo?.street,

          number: unit.num,
          area: unit.area || '0',
          livingArea: unit.livingArea || '0',
          usefulArea: unit.usefulArea || '0',

          blockLabel: blockLabel,
          floorLabel: floorLabel,
          entrance: entrance || '-',
          isSaved: true,
        });
      });
    });

    return list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  }, [composition, flatMatrix, buildingDetails, complexInfo, resolveFloorLabel]);

  const filteredData = useMemo(() => {
    return allObjects.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        String(item.number).toLowerCase().includes(searchLower) ||
        String(item.houseNumber).toLowerCase().includes(searchLower);

      const matchesBuilding = filters.building === 'all' || item.buildingId === filters.building;
      // Приводим к строке для надежного сравнения
      const matchesEntrance =
        filters.entrance === 'all' || String(item.entrance) === String(filters.entrance);
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

  const options = useMemo(() => {
    const contextData =
      filters.building === 'all'
        ? allObjects
        : allObjects.filter(d => d.buildingId === filters.building);

    return {
      entrances: [...new Set(contextData.map(d => d.entrance).filter(e => e && e !== '-'))].sort(
        (a, b) => parseInt(a) - parseInt(b)
      ),
      floors: [...new Set(contextData.map(d => d.floorLabel).filter(f => f && f !== '-'))].sort(
        (a, b) => parseInt(a) - parseInt(b)
      ),
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
