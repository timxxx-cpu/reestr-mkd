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

        // 2. Генерируем ОФИСЫ
        const countOffices = parseInt(cellData.units || 0); 
        for (let k = 0; k < countOffices; k++) {
          newUnits.push({
            id: crypto.randomUUID(),
            floorId: f.id,
            entranceId: e.id,
            num: String(currentNum++),
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

    entrances.forEach(e => {
      floorsAsc.forEach(f => {
        const matrixKey = `${f.id}_${e.number}`;
        
        // Получаем плановые количества из матрицы
        const countFlats = parseInt(matrixMap[matrixKey]?.apts || 0);
        const countOffices = parseInt(matrixMap[matrixKey]?.units || 0);
        
        // Берем существующие квартиры в этой ячейке (они уже отсортированы в gridMap)
        const existingInCell = gridMap[f.id]?.[e.id] || [];
        let existingIndex = 0;

        // Вспомогательная функция для создания/обновления
        const processUnit = (targetType) => {
          const existingUnit = existingInCell[existingIndex];
          const newNum = String(currentNum++);
          
          if (existingUnit) {
            // Если юнит уже есть — обновляем
            // ВАЖНО: Если тип меняется (например Office -> Flat), нужно сбросить unitCode,
            // чтобы сервер сгенерировал новый (EF... вместо EO...).
            // Если тип тот же — сохраняем unitCode, чтобы не было конфликта уникальности.
            const shouldPreserveCode = existingUnit.type === targetType;

            updates.push({
              id: existingUnit.id,
              floorId: f.id,
              entranceId: e.id,
              num: newNum,
              type: targetType,
              // Если тип совпадает — оставляем старый код. Если нет — null (пусть пересоздастся)
              unitCode: shouldPreserveCode ? existingUnit.unitCode : null
            });
          } else {
            // Если юнита нет (дырка) — создаем новый
            updates.push({
              id: crypto.randomUUID(),
              floorId: f.id,
              entranceId: e.id,
              num: newNum,
              type: targetType,
              rooms_count: 0,
              total_area: 0
            });
          }
          existingIndex++;
        };

        // 1. Проход по КВАРТИРАМ
        for (let i = 0; i < countFlats; i++) {
          processUnit('flat');
        }

        // 2. Проход по ОФИСАМ
        for (let k = 0; k < countOffices; k++) {
          processUnit('office');
        }
        
        // Примечание: Если в existingInCell осталось больше юнитов, чем (countFlats + countOffices),
        // они останутся в БД "как есть" до следующей синхронизации (reconcile), 
        // но нумерация пойдет дальше корректно.
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