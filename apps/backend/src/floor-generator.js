/**
 * Сервис генерации этажной модели на стороне бэкенда.
 * Заменяет старую логику buildFloorList из фронтенда.
 */

export function generateFloorsModel(block, building, allBlocks, markers) {
  const targetFloors = [];

  const isParking = building.category === 'parking_separate' || block.type === 'Parking';
  const isInfrastructure = building.category === 'infrastructure' || block.type === 'Infra';
  const isUndergroundParking =
    isParking &&
    (building.parking_type === 'underground' ||
      building.construction_type === 'underground' ||
      Number(block.levels_depth || 0) > 0);

  // Вспомогательная функция для проверки маркеров
  const getMarker = (key) => markers.find((m) => m.marker_key === key) || {};

  // 1. Подземный паркинг (целиком)
  if (isUndergroundParking) {
    const depth = Number(block.levels_depth || 1);
    for (let i = 1; i <= depth; i++) {
      targetFloors.push(createFloorObj(block.id, {
        index: -i,
        floor_key: `parking:-${i}`,
        label: `Уровень -${i}`,
        floor_type: 'parking_floor',
        is_commercial: false,
      }));
    }
    return targetFloors;
  }

  // 2. Подвалы (как отдельные блоки building_blocks с is_basement_block=true)
  const blockBasements = (allBlocks || []).filter(
    b => b.is_basement_block && Array.isArray(b.linked_block_ids) && b.linked_block_ids.includes(block.id)
  );
  const hasMultipleBasements = blockBasements.length > 1;

  blockBasements.forEach((b, bIdx) => {
    const depth = Number(b.basement_depth || 1);
    for (let d = depth; d >= 1; d--) {
      const levelsMap = b.basement_parking_levels && typeof b.basement_parking_levels === 'object'
        ? b.basement_parking_levels
        : {};
      const isMixed = getMarker(`basement_${b.id}`).is_commercial || getMarker('basement').is_commercial || !!levelsMap[String(d)];
      let label = `Подвал (этаж -${d})`;
      if (hasMultipleBasements) label = `Подвал ${bIdx + 1} (этаж -${d})`;

      targetFloors.push(createFloorObj(block.id, {
        index: -d,
        floor_key: `basement:${b.id}:${d}`,
        label,
        floor_type: 'basement',
        basement_id: b.id,
        is_commercial: isMixed,
        is_basement: true,
      }));
    }
  });

  // 3. Цокольный этаж
  if (block.has_basement) { // Флаг has_basement в таблице building_blocks отвечает за цоколь
    const isTsokolMixed = getMarker('tsokol').is_commercial;
    targetFloors.push(createFloorObj(block.id, {
      index: 0,
      floor_key: 'tsokol',
      label: 'Цокольный этаж',
      floor_type: 'tsokol',
      is_commercial: !!isTsokolMixed,
    }));
  }

  // 4. Построение карты стилобатов (stylobateMap)
  const stylobateMap = {};
  if (block.type === 'Ж') {
    allBlocks.forEach((b) => {
      if (b.is_basement_block) return;
      if (b.type === 'Н' && b.parent_blocks && b.parent_blocks.includes(block.id)) {
        const h = Number(b.floors_to || 0);
        for (let k = 1; k <= h; k++) {
          stylobateMap[k] = b.label; // Запоминаем, что этот этаж перекрыт стилобатом
        }
      }
    });
  }

  // 5. Основные этажи
  let start = 1;
  let end = 1;

  if (isParking || isInfrastructure) {
    start = 1;
    end = Number(block.floors_count || 1);
  } else {
    start = Number(block.floors_from || 1);
    end = Number(block.floors_to || 1);
  }

  for (let i = start; i <= end; i++) {
    const stylobateLabel = stylobateMap[i];
    const floorKey = `floor:${i}`;
    const marker = getMarker(String(i)); // Ищем маркер по номеру этажа
    const isMixed = !!marker.is_commercial;

    if (stylobateLabel) {
      targetFloors.push(createFloorObj(block.id, {
        index: i,
        floor_key: floorKey,
        label: `${i} этаж`,
        floor_type: 'stylobate',
        is_commercial: true,
        is_stylobate: true,
      }));
    } else {
      let type = 'residential';
      if (block.type === 'Н') type = 'office';
      if (isParking) type = 'parking_floor';
      if (isInfrastructure) type = 'office';
      if (block.type === 'Ж' && isMixed) type = 'mixed';

      targetFloors.push(createFloorObj(block.id, {
        index: i,
        floor_key: floorKey,
        label: `${i} этаж`,
        floor_type: type,
        is_commercial: isMixed || type === 'office',
      }));
    }

    // Технические этажи, вставленные между обычными (например, 5-Т)
    const techMarker = getMarker(`${i}-Т`);
    if (techMarker.is_technical) {
      targetFloors.push(createFloorObj(block.id, {
        index: i,
        floor_key: `tech:${i}`,
        label: `${i}-Т (Технический)`,
        floor_type: 'technical',
        is_commercial: !!techMarker.is_commercial,
        is_technical: true,
        parent_floor_index: i,
      }));
    }
  }

  // 6. Дополнительные технические этажи (выше крыши)
  markers.filter(m => m.marker_type === 'technical' && Number(m.floor_index) > end).forEach(m => {
    const fIdx = Number(m.floor_index);
    targetFloors.push(createFloorObj(block.id, {
      index: fIdx,
      floor_key: `tech:${fIdx}`,
      label: `${fIdx} (Тех)`,
      floor_type: 'technical',
      is_technical: true,
      parent_floor_index: fIdx,
    }));
  });

  // 7. Верхние уровни: Мансарда, Чердак, Кровля
  if (block.has_attic) {
    targetFloors.push(createFloorObj(block.id, {
      index: end + 1,
      floor_key: 'attic',
      label: 'Мансарда',
      floor_type: 'attic',
      is_commercial: !!getMarker('attic').is_commercial,
      is_attic: true,
    }));
  }

  if (block.has_loft) {
    targetFloors.push(createFloorObj(block.id, {
      index: end + 2,
      floor_key: 'loft',
      label: 'Чердак',
      floor_type: 'loft',
      is_commercial: !!getMarker('loft').is_commercial,
      is_loft: true,
    }));
  }

  if (block.has_roof_expl) {
    targetFloors.push(createFloorObj(block.id, {
      index: end + 3,
      floor_key: 'roof',
      label: 'Эксплуатируемая кровля',
      floor_type: 'roof',
      is_commercial: !!getMarker('roof').is_commercial,
      is_roof: true,
    }));
  }

  return targetFloors;
}

// Утилита для формирования единообразного объекта
function createFloorObj(blockId, overrides) {
  return {
    block_id: blockId,
    height: null,
    area_proj: 0,
    is_technical: false,
    is_commercial: false,
    is_stylobate: false,
    is_basement: false,
    is_attic: false,
    is_loft: false,
    is_roof: false,
    parent_floor_index: null,
    basement_id: null,
    ...overrides,
  };
}