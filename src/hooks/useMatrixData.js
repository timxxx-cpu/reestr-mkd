import { useMemo, useCallback } from 'react';

const normalizeNumKey = value => String(value ?? '').trim().toLowerCase();
export const OUTSIDE_ENTRANCE_KEY = '__outside__';

const toInt = value => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const resolveEntranceNumber = entrance => {
  if (entrance && entrance.matrixNumber !== undefined && entrance.matrixNumber !== null) {
    const parsed = Number.parseInt(String(entrance.matrixNumber), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number.parseInt(String(entrance?.number ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveEntranceKey = entrance => {
  const id = entrance?.id;
  if (!id || id === OUTSIDE_ENTRANCE_KEY) return OUTSIDE_ENTRANCE_KEY;
  return id;
};

const resolvePayloadEntranceId = entrance => {
  if (Object.prototype.hasOwnProperty.call(entrance ?? {}, 'unitEntranceId')) {
    return entrance.unitEntranceId ?? null;
  }
  return resolveEntranceKey(entrance) === OUTSIDE_ENTRANCE_KEY
    ? null
    : resolveEntranceKey(entrance);
};

export function useMatrixData(units, floors, entrances, matrixMap) {
  const gridMap = useMemo(() => {
    const map = {};
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
      const entranceKey = u.entranceId ?? OUTSIDE_ENTRANCE_KEY;
      if (!map[u.floorId][entranceKey]) map[u.floorId][entranceKey] = [];
      map[u.floorId][entranceKey].push(u);
    });

    return map;
  }, [units]);

  const generateInitialUnits = useCallback((startNum = 1) => {
    let currentNum = startNum;
    const newUnits = [];
    const floorsAsc = [...floors].sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));

    entrances.forEach(entrance => {
      const entranceNumber = resolveEntranceNumber(entrance);
      const payloadEntranceId = resolvePayloadEntranceId(entrance);

      floorsAsc.forEach(floor => {
        const matrixKey = `${floor.id}_${entranceNumber}`;
        const cellData = matrixMap[matrixKey] || {};
        const countFlats = toInt(cellData.apts);
        const countOffices = toInt(cellData.units);

        for (let i = 0; i < countFlats; i++) {
          newUnits.push({
            id: crypto.randomUUID(),
            floorId: floor.id,
            entranceId: payloadEntranceId,
            num: String(currentNum++),
            type: 'flat',
            rooms_count: 0,
            total_area: 0,
          });
        }

        for (let i = 0; i < countOffices; i++) {
          newUnits.push({
            id: crypto.randomUUID(),
            floorId: floor.id,
            entranceId: payloadEntranceId,
            num: String(currentNum++),
            type: 'office',
            rooms_count: 0,
            total_area: 0,
          });
        }
      });
    });

    return newUnits;
  }, [floors, entrances, matrixMap]);

  const prepareResetPayload = useCallback((startNum = 1) => {
    let currentNum = startNum;
    const updates = [];
    const unitsList = Array.isArray(units) ? units : [];
    const floorsAsc = [...floors].sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));

    const existingIdsToRenumber = new Set();
    entrances.forEach(entrance => {
      const entranceKey = resolveEntranceKey(entrance);
      const entranceNumber = resolveEntranceNumber(entrance);

      floorsAsc.forEach(floor => {
        const matrixKey = `${floor.id}_${entranceNumber}`;
        const countFlats = toInt(matrixMap[matrixKey]?.apts);
        const countOffices = toInt(matrixMap[matrixKey]?.units);
        const plannedCount = countFlats + countOffices;
        const existingInCell = gridMap[floor.id]?.[entranceKey] || [];

        for (let i = 0; i < plannedCount && i < existingInCell.length; i++) {
          const existingId = existingInCell[i]?.id;
          if (existingId) {
            existingIdsToRenumber.add(existingId);
          }
        }
      });
    });

    const occupiedNums = new Set(
      unitsList
        .filter(unit => !existingIdsToRenumber.has(unit?.id))
        .map(unit => normalizeNumKey(unit?.num ?? unit?.number))
        .filter(Boolean)
    );

    const allocateNextNumber = () => {
      let candidate = String(currentNum++);
      while (occupiedNums.has(normalizeNumKey(candidate))) {
        candidate = String(currentNum++);
      }
      occupiedNums.add(normalizeNumKey(candidate));
      return candidate;
    };

    entrances.forEach(entrance => {
      const entranceKey = resolveEntranceKey(entrance);
      const entranceNumber = resolveEntranceNumber(entrance);
      const payloadEntranceId = resolvePayloadEntranceId(entrance);

      floorsAsc.forEach(floor => {
        const matrixKey = `${floor.id}_${entranceNumber}`;
        const countFlats = toInt(matrixMap[matrixKey]?.apts);
        const countOffices = toInt(matrixMap[matrixKey]?.units);
        const existingInCell = gridMap[floor.id]?.[entranceKey] || [];
        let existingIndex = 0;

        const processUnit = targetType => {
          const existingUnit = existingInCell[existingIndex];

          if (existingUnit) {
            const newNum = allocateNextNumber();
            const shouldPreserveCode = existingUnit.type === targetType;
            updates.push({
              id: existingUnit.id,
              floorId: floor.id,
              entranceId: payloadEntranceId,
              num: newNum,
              type: targetType,
              unitCode: shouldPreserveCode ? existingUnit.unitCode : null,
            });
          } else {
            const newNum = allocateNextNumber();
            updates.push({
              id: crypto.randomUUID(),
              floorId: floor.id,
              entranceId: payloadEntranceId,
              num: newNum,
              type: targetType,
              rooms_count: 0,
              total_area: 0,
            });
          }

          existingIndex++;
        };

        for (let i = 0; i < countFlats; i++) {
          processUnit('flat');
        }
        for (let i = 0; i < countOffices; i++) {
          processUnit('office');
        }
      });
    });

    return updates;
  }, [floors, entrances, matrixMap, gridMap, units]);

  return {
    gridMap,
    generateInitialUnits,
    prepareResetPayload,
  };
}
