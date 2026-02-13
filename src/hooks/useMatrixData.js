import { useMemo, useCallback } from 'react';

export function useMatrixData(units, floors, entrances, matrixMap) {
  
  // 1. Превращаем плоский список квартир из БД в сетку
  const gridMap = useMemo(() => {
    const map = {};
    
    // Сортируем квартиры "по-человечески" (1, 2, 10)
    const sortedUnits = [...units].sort((a, b) => {
      const numA = String(a.num || '');
      const numB = String(b.num || '');
      
      if (!numA && numB) return 1;
      if (numA && !numB) return -1;
      if (!numA && !numB) return 0;
      
      return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedUnits.forEach(u => {
      if (!map[u.floorId]) map[u.floorId] = {};
      if (!map[u.floorId][u.entranceId]) map[u.floorId][u.entranceId] = [];
      map[u.floorId][u.entranceId].push(u);
    });
    
    return map;
  }, [units]);

  // 2. Логика генерации первичных данных (для пустой базы)
  const generateInitialUnits = useCallback((startNum = 1) => {
    let currentNum = startNum;
    const newUnits = [];

    // Сортируем этажи СНИЗУ ВВЕРХ для правильной нумерации (1, 2, 3...)
    const floorsAsc = [...floors].sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));

    entrances.forEach(e => {
      floorsAsc.forEach(f => {
        const matrixKey = `${f.id}_${e.number}`;
        const cellData = matrixMap[matrixKey] || {};
        
        // 1. Генерируем КВАРТИРЫ
        const countFlats = parseInt(cellData.apts || 0);
        for (let i = 0; i < countFlats; i++) {
          newUnits.push({
            id: crypto.randomUUID(),
            floorId: f.id,
            entranceId: e.id,
            num: String(currentNum++),
            type: 'flat', // Тип Квартира
            rooms_count: 0,
            total_area: 0
          });
        }

        // 2. Генерируем ОФИСЫ (Добавлено)
        // В api-service.js поле commercial_count мапится в свойство .units
        const countOffices = parseInt(cellData.units || 0); 
        for (let k = 0; k < countOffices; k++) {
          newUnits.push({
            id: crypto.randomUUID(),
            floorId: f.id,
            entranceId: e.id,
            num: String(currentNum++), // Сквозная нумерация (или можно вести отдельную)
            type: 'office', // Тип Офис
            rooms_count: 0,
            total_area: 0
          });
        }
      });
    });

    return newUnits;
  }, [floors, entrances, matrixMap]);

  // 3. Логика полного сброса и перенумерации (OVERWRITE)
  const prepareResetPayload = useCallback((startNum = 1) => {
    let currentNum = startNum;
    const updates = [];

    // Сортируем этажи СНИЗУ ВВЕРХ
    const floorsAsc = [...floors].sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));

    // Используем gridMap, чтобы находить существующие квартиры по координатам
    // НО! gridMap построен на отсортированных данных. 
    // Для "сброса" надежнее брать квартиры в том порядке, в котором они сейчас лежат в gridMap (по порядку номеров), 
    // либо просто брать слоты по порядку.
    
    // ВАЖНО: Если мы хотим "Сбросить", мы должны игнорировать текущие номера и просто брать слоты по порядку (0, 1, 2...).
    // Но в gridMap у нас квартиры лежат по индексу массива.
    
    entrances.forEach(e => {
      floorsAsc.forEach(f => {
        const matrixKey = `${f.id}_${e.number}`;
        const count = parseInt(matrixMap[matrixKey]?.apts || 0);
        
        // Берем существующие квартиры в этой ячейке
        const existingInCell = gridMap[f.id]?.[e.id] || [];

        for (let i = 0; i < count; i++) {
          const existingUnit = existingInCell[i];
          const newNum = String(currentNum++);
          
          if (existingUnit) {
            // Если квартира есть - обновляем её (превращаем в flat и меняем номер)
            updates.push({
              id: existingUnit.id,
              floorId: f.id,       // на всякий случай
              entranceId: e.id,    // на всякий случай
              num: newNum,
              type: 'flat',        // Сброс типа
              // Можно добавить сброс площадей, если нужно: total_area: 0
            });
          } else {
            // Если квартиры нет (дырка) - создаем новую
            updates.push({
              id: crypto.randomUUID(),
              floorId: f.id,
              entranceId: e.id,
              num: newNum,
              type: 'flat',
              rooms_count: 0,
              total_area: 0
            });
          }
        }
      });
    });

    return updates;
  }, [floors, entrances, matrixMap, gridMap]);

  return {
    gridMap,
    generateInitialUnits,
    prepareResetPayload
  };
}
