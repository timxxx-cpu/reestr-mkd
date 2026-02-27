/**
 * Логика валидации шагов workflow для проекта.
 * Выделена из server.js в отдельный модуль для читаемости и тестируемости.
 */

function buildValidationError(code, title, message, meta = {}) {
  return { code, title, message, meta };
}

// Хелпер для формирования детального заголовка ошибки с кодом ЗДАНИЯ
function getEntityTitle(building, block) {
  const bCodeStr = building?.building_code ? `[${building.building_code}] ` : '';
  const houseStr = building?.house_number ? ` (д. ${building.house_number})` : '';
  const bLabel = building?.label || 'Неизвестный объект';
  
  if (!block) {
    return `${bCodeStr}Объект: ${bLabel}${houseStr}`;
  }
  
  const blkLabel = block.label || 'Основной блок';
  return `${bCodeStr}Объект: ${bLabel}${houseStr} (Блок: ${blkLabel})`;
}

export async function buildStepValidationResult(supabase, { projectId, stepId }) {
  const normalizedStepId = String(stepId || '').trim();
  const errors = [];

  // Добавляем building_code в выборку
  const { data: buildings, error: buildingsError } = await supabase
    .from('buildings')
    .select(`
      id, label, building_code, house_number, category, construction_type, parking_type, infra_type, has_non_res_part,
      building_blocks (
        id, label, type, floors_from, floors_to, floors_count, entrances_count,
        elevators_count, levels_depth, vehicle_entries, light_structure_type,
        is_basement_block, linked_block_ids, basement_depth, basement_has_parking, basement_parking_levels, basement_communications,
        has_custom_address, custom_house_number,
        block_construction (foundation, walls, slabs, roof, seismicity),
        block_engineering (has_electricity, has_water, has_hot_water, has_sewerage, has_gas, has_heating, has_ventilation, has_firefighting, has_lowcurrent)
      )
    `)
    .eq('project_id', projectId);

  if (buildingsError) {
    return { ok: false, status: 500, code: 'DB_ERROR', message: buildingsError.message };
  }

  const allBuildings = buildings || [];
  const allBlocks = allBuildings.flatMap(b => b.building_blocks || []);
  const residentialBlocks = allBlocks.filter(block => block.type === 'Ж');

  if (normalizedStepId === 'composition') {
    const hasResidential = allBuildings.some(b => b.category?.includes('residential'));
    if (!hasResidential) {
      errors.push(buildValidationError('NO_RESIDENTIAL', 'Ошибка состава объектов', 'В проекте отсутствует жилой дом. Необходимо добавить хотя бы один объект типа "Жилой дом" или "Многоблочный".'));
    }
  }

  if (normalizedStepId === 'registry_nonres') {
    allBuildings.forEach(building => {
      const isParking = building.category === 'parking_separate';
      const isInfra = building.category === 'infrastructure';
      const isUnderground = building.parking_type === 'underground' || building.construction_type === 'underground';
      const nonResBlocks = (building.building_blocks || []).filter(blk => 
        blk.type !== 'Ж' && 
        !blk.is_basement_block && 
        blk.type !== 'BAS' && 
        blk.type !== 'ПД'
      );

      nonResBlocks.forEach(block => {
        const title = getEntityTitle(building, block);
        const constr = Array.isArray(block.block_construction) ? block.block_construction[0] : block.block_construction;

        if (isInfra) {
          if (!block.floors_count) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Количество этажей" обязательно'));
          if (!block.entrances_count) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Количество входов" обязательно'));
          if (!constr?.foundation) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Фундамент" обязательно'));
          if (!constr?.walls) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Материал стен" обязательно'));
          if (!constr?.slabs) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Перекрытия" обязательно'));
          if (!constr?.roof) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Кровля" обязательно'));
          if (constr?.seismicity === null || constr?.seismicity === undefined) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Сейсмичность" обязательно'));
        } else if (isParking) {
          if (building.construction_type === 'capital') {
            if (!constr?.foundation) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Фундамент" обязательно'));
            if (!constr?.walls) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Материал стен" обязательно'));
            if (!constr?.slabs) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Перекрытия" обязательно'));
            if (!constr?.roof) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Кровля" обязательно'));
            if (constr?.seismicity === null || constr?.seismicity === undefined) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Сейсмичность" обязательно'));
            if (!block.vehicle_entries) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Въезды" обязательно'));
            if (!block.entrances_count) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Количество входов" обязательно'));
            if (isUnderground) {
              if (!block.levels_depth) errors.push(buildValidationError('MISSING_FIELD', title, 'Не указана глубина подземного паркинга.'));
            } else {
              if (!block.floors_count) errors.push(buildValidationError('MISSING_FIELD', title, 'Не указано количество этажей паркинга.'));
            }
          } else if (building.construction_type === 'light') {
            if (!block.light_structure_type) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Тип конструкции" обязательно для легкого паркинга'));
          }
        }
      });
    });
  }

  if (normalizedStepId === 'registry_res') {
    const resBuildings = allBuildings.filter(b => b.category?.includes('residential'));
    resBuildings.forEach(building => {
      const blocks = (building.building_blocks || []).filter(blk => blk.type === 'Ж');
      if (blocks.length === 0) {
        errors.push(buildValidationError('NO_BLOCKS', getEntityTitle(building, null), 'Нет жилых блоков.'));
        return;
      }

      blocks.forEach(block => {
        const title = getEntityTitle(building, block);
        const constr = Array.isArray(block.block_construction) ? block.block_construction[0] : block.block_construction;
        const eng = Array.isArray(block.block_engineering) ? block.block_engineering[0] : block.block_engineering;

        if (!constr?.foundation) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Фундамент" обязательно'));
        if (!constr?.walls) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Материал стен" обязательно'));
        if (!constr?.slabs) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Перекрытия" обязательно'));
        if (!constr?.roof) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Кровля" обязательно'));
        if (constr?.seismicity === null || constr?.seismicity === undefined) errors.push(buildValidationError('MISSING_FIELD', title, 'Поле "Сейсмичность" обязательно'));
        if (!block.entrances_count) errors.push(buildValidationError('MISSING_FIELD', title, 'Не указано количество подъездов'));
        if (!block.floors_from) errors.push(buildValidationError('MISSING_FIELD', title, 'Не указана "Этажность (с)"'));
        if (!block.floors_to) errors.push(buildValidationError('MISSING_FIELD', title, 'Не указана "Этажность (по)"'));

        const floorsToCheck = block.floors_to || 1;
        if (floorsToCheck > 5 && (!block.elevators_count || block.elevators_count < 1)) {
          errors.push(buildValidationError('ELEVATOR_REQUIRED', title, `Здание выше 5 этажей (${floorsToCheck} эт.) обязано иметь хотя бы 1 лифт`));
        }

        if (!eng || !Object.values(eng).some(v => v === true)) {
          errors.push(buildValidationError('ENGINEERING_REQUIRED', title, 'Не выбрана ни одна инженерная коммуникация'));
        }
      });
    });
  }


  if (normalizedStepId === 'basement_inventory') {
    allBuildings.forEach(building => {
      const basementBlocks = (building.building_blocks || []).filter(blk => blk.is_basement_block === true);
      const regularBlocks = (building.building_blocks || []).filter(blk => !blk.is_basement_block);
      const isMultiblockResidential = building.category?.includes('residential') && regularBlocks.length > 1;

      basementBlocks.forEach(block => {
        const title = getEntityTitle(building, block);
        const depth = Number.parseInt(block.basement_depth || 1, 10);
        if (!Number.isInteger(depth) || depth < 1 || depth > 4) {
          errors.push(buildValidationError('BASEMENT_DEPTH_INVALID', title, 'Глубина подвала должна быть в диапазоне -1..-4.'));
        }

        const comm = block.basement_communications;
        const commKeys = ['electricity', 'water', 'sewerage', 'heating', 'ventilation', 'gas', 'firefighting'];
        const hasCommShape = comm && typeof comm === 'object' && commKeys.every(k => typeof comm[k] === 'boolean');
        if (!hasCommShape) {
          errors.push(buildValidationError('BASEMENT_COMM_REQUIRED', title, 'Необходимо указать коммуникации подвала.'));
        }

        const links = Array.isArray(block.linked_block_ids) ? block.linked_block_ids : [];
        if (isMultiblockResidential && links.length === 0) {
          errors.push(buildValidationError('BASEMENT_LINKS_REQUIRED', title, 'Для многоблочного жилого дома нужно указать обслуживаемые блоки.'));
        }

        const levels = block.basement_parking_levels && typeof block.basement_parking_levels === 'object'
          ? block.basement_parking_levels
          : {};
        Object.entries(levels).forEach(([lvlKey, enabled]) => {
          const lvl = Number.parseInt(lvlKey, 10);
          if (!Number.isInteger(lvl) || lvl < 1 || lvl > depth) {
            errors.push(buildValidationError('BASEMENT_PARKING_LEVEL_INVALID', title, 'Уровни паркинга в подвале должны быть в диапазоне глубины подвала.'));
          }
          if (typeof enabled !== 'boolean') {
            errors.push(buildValidationError('BASEMENT_PARKING_LEVEL_FLAG_INVALID', title, 'Флаг активности уровня паркинга должен быть boolean.'));
          }
        });
      });
    });
  }

  if (normalizedStepId === 'floors') {
    if (allBlocks.length === 0) {
      errors.push(buildValidationError('NO_BLOCKS', 'Матрица этажей', 'В проекте отсутствуют блоки'));
    } else {
      const blockIds = allBlocks.map(b => b.id);
      const { data: floors } = await supabase.from('floors').select('*').in('block_id', blockIds);
      const floorsByBlock = (floors || []).reduce((acc, f) => {
        if (!acc[f.block_id]) acc[f.block_id] = [];
        acc[f.block_id].push(f);
        return acc;
      }, {});

      allBlocks.forEach(block => {
        const building = allBuildings.find(b => (b.building_blocks || []).some(blk => blk.id === block.id));
        const title = getEntityTitle(building, block);
        const blockFloors = floorsByBlock[block.id] || [];

        if (blockFloors.length === 0) {
          errors.push(buildValidationError('NO_FLOORS', title, 'Нет данных об этажах. Заполните матрицу высот и площадей.'));
          return;
        }

        blockFloors.forEach(f => {
          if (f.is_stylobate || f.floor_type === 'stylobate') return;

          const fLabel = f.label || `${f.index} этаж`;

          if (f.floor_type !== 'roof') {
            if (!f.height) {
              errors.push(buildValidationError('NO_HEIGHT', title, `${fLabel}: Не указана высота.`));
            } else {
              const h = parseFloat(f.height);
              if (f.floor_type === 'basement' && (h < 1.8 || h > 4.0)) {
                errors.push(buildValidationError('BAD_HEIGHT', title, `${fLabel}: Высота подвала должна быть 1.8-4.0 м.`));
              } else if (f.floor_type === 'technical' && (h < 1.5 || h > 6.0)) {
                errors.push(buildValidationError('BAD_HEIGHT', title, `${fLabel}: Высота технического этажа должна быть 1.5-6.0 м.`));
              } else if (!['basement', 'technical'].includes(f.floor_type) && (h < 2.0 || h > 6.0)) {
                errors.push(buildValidationError('BAD_HEIGHT', title, `${fLabel}: Высота должна быть 2.0-6.0 м.`));
              }
            }
          }

          if (!f.area_proj || parseFloat(f.area_proj) <= 0) {
            errors.push(buildValidationError('NO_AREA_PROJ', title, `${fLabel}: Не указана проектная площадь.`));
          } else if (f.area_fact) {
            const proj = parseFloat(f.area_proj);
            const fact = parseFloat(f.area_fact);
            if ((Math.abs(proj - fact) / proj) * 100 > 15) {
              errors.push(buildValidationError('AREA_DIFF', title, `${fLabel}: Критическое расхождение S Проект/Факт (>15%). Уточните замеры.`));
            }
          }
        });
      });
    }
  }

  if (normalizedStepId === 'apartments') {
    if (residentialBlocks.length > 0) {
      const blockIds = residentialBlocks.map(b => b.id);
      const { data: floors } = await supabase.from('floors').select('id, block_id, label').in('block_id', blockIds);
      const floorIds = (floors || []).map(f => f.id);

      if (floorIds.length > 0) {
        const { data: units } = await supabase.from('units').select('id, floor_id, number').in('floor_id', floorIds);
        const unitsByBlock = {};

        (units || []).forEach(u => {
          const floor = floors.find(f => f.id === u.floor_id);
          if (!floor) return;
          const bId = floor.block_id;
          if (!unitsByBlock[bId]) unitsByBlock[bId] = {};
          const num = String(u.number || '').trim();
          if (num !== '') {
            if (unitsByBlock[bId][num]) {
              const block = allBlocks.find(b => b.id === bId);
              const building = allBuildings.find(b => (b.building_blocks || []).some(blk => blk.id === bId));
              const title = getEntityTitle(building, block);
              errors.push(buildValidationError('DUPLICATE_UNIT', title, `Дубликаты номеров: обнаружен повторяющийся номер квартиры: "${num}".`));
            }
            unitsByBlock[bId][num] = true;
          }
        });
      } else {
        errors.push(buildValidationError('FLOORS_REQUIRED', 'Помещения', 'Сначала заполните этажи для жилых блоков'));
      }
    }
  }

  if (normalizedStepId === 'entrances') {
    residentialBlocks.forEach(block => {
      if (!Number(block.entrances_count)) {
        const building = allBuildings.find(b => (b.building_blocks || []).some(blk => blk.id === block.id));
        const title = getEntityTitle(building, block);
        errors.push(buildValidationError('ENTRANCES_REQUIRED', title, 'Для жилого блока отсутствуют подъезды', { blockId: block.id }));
      }
    });
  }

  return { ok: true, errors };
}