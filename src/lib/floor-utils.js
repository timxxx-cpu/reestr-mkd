import { getBlocksList } from './utils';

/**
 * Генерация списка этажей и признаков для блока здания.
 * Используется для синхронизации floors и для UI.
 * @param {import('./types').BuildingMeta} building
 * @param {import('./dto').BuildingBlock} currentBlock
 * @param {Record<string, any>} buildingDetails
 */
export const buildFloorList = (building, currentBlock, buildingDetails = {}) => {
  if (!building || !currentBlock) return [];

  const list = [];
  const detailsKey = `${building.id}_${currentBlock.id}`;

  const effectiveDetailsKey =
    currentBlock.id === 'main' &&
    (building.category === 'parking_separate' || building.category === 'infrastructure')
      ? `${building.id}_main`
      : detailsKey;

  const blockDetails = buildingDetails[effectiveDetailsKey] || {};
  const features = buildingDetails[`${building.id}_features`] || {};
  const basements = features.basements || [];
  const commFloors = (blockDetails.commercialFloors || []).map(val => String(val));

  const isParking =
    building.category === 'parking_separate' || currentBlock.originalType === 'parking';
  const isInfrastructure =
    building.category === 'infrastructure' || currentBlock.originalType === 'infrastructure';

  const isUndergroundParking =
    isParking &&
    (building.parkingType === 'underground' ||
      building.constructionType === 'underground' ||
      Number(blockDetails.levelsDepth || 0) > 0);

  if (isUndergroundParking) {
    const depth = Number(blockDetails.levelsDepth || 1);
    for (let i = 1; i <= depth; i++) {
      list.push({
        id: `level_minus_${i}`,
        floorKey: `parking:-${i}`,
        label: `Уровень -${i}`,
        type: 'parking_floor',
        index: -i,
        sortOrder: -i,
        isComm: false,
        isStylobate: false,
        isSeparator: false,
        isInserted: false,
        parentFloorIndex: null,
        basementId: null,
        flags: {
          isTechnical: false,
          isCommercial: false,
          isStylobate: false,
          isBasement: false,
          isAttic: false,
          isLoft: false,
          isRoof: false,
        },
      });
    }
    return list.sort((a, b) => b.sortOrder - a.sortOrder);
  }

  const currentBlockBasements = basements.filter(b => b.blocks?.includes(currentBlock.id));
  const hasMultipleBasements = currentBlockBasements.length > 1;

  currentBlockBasements.forEach((b, bIdx) => {
    const depth = Number(b.depth || 1);
    const isThisBasementMixed =
      commFloors.includes(`basement_${b.id}`) || commFloors.includes('basement');

    for (let d = depth; d >= 1; d--) {
      let label = `Подвал (этаж -${d})`;
      if (hasMultipleBasements) label = `Подвал ${bIdx + 1} (этаж -${d})`;

      list.push({
        id: `base_${b.id}_L${d}`,
        floorKey: `basement:${b.id}:${d}`,
        label,
        type: 'basement',
        index: -d,
        sortOrder: -1000 - d + Number(bIdx) * 0.1,
        isComm: isThisBasementMixed,
        isStylobate: false,
        isSeparator: d === 1,
        isInserted: false,
        parentFloorIndex: null,
        basementId: b.id,
        flags: {
          isTechnical: false,
          isCommercial: isThisBasementMixed,
          isStylobate: false,
          isBasement: true,
          isAttic: false,
          isLoft: false,
          isRoof: false,
        },
      });
    }
  });

  if (blockDetails.hasBasementFloor) {
    const isTsokolMixed = commFloors.includes('tsokol');
    list.push({
      id: 'floor_0',
      floorKey: 'tsokol',
      label: 'Цокольный этаж',
      type: 'tsokol',
      index: 0,
      sortOrder: 0,
      isComm: isTsokolMixed,
      isStylobate: false,
      isSeparator: true,
      isInserted: false,
      parentFloorIndex: null,
      basementId: null,
      flags: {
        isTechnical: false,
        isCommercial: isTsokolMixed,
        isStylobate: false,
        isBasement: false,
        isAttic: false,
        isLoft: false,
        isRoof: false,
      },
    });
  }

  const stylobateMap = {};
  if (currentBlock.type === 'Ж') {
    const allBlocks = getBlocksList(building, buildingDetails);
    allBlocks.forEach(b => {
      if (b.type === 'Н') {
        const bDetails = buildingDetails[`${building.id}_${b.id}`];
        if (bDetails?.parentBlocks?.includes(currentBlock.id)) {
          const h = Number(bDetails.floorsTo || 0);
          for (let k = 1; k <= h; k++) {
            stylobateMap[k] = b.tabLabel;
          }
        }
      }
    });
  }

  let start = 1;
  let end = 1;

  if (isParking || isInfrastructure) {
    start = 1;
    end = Number(blockDetails.floorsCount || 1);
  } else {
    start = Number(blockDetails.floorsFrom || 1);
    end = Number(blockDetails.floorsTo || 1);
  }

  for (let i = start; i <= end; i++) {
    const stylobateSource = stylobateMap[i];
    const floorKey = `floor:${i}`;

    if (stylobateSource) {
      list.push({
        id: `floor_${i}`,
        floorKey,
        label: `${i} этаж`,
        index: i,
        type: 'stylobate',
        isStylobate: true,
        stylobateLabel: stylobateSource,
        isComm: true,
        sortOrder: i * 10,
        isSeparator: false,
        isInserted: false,
        parentFloorIndex: null,
        basementId: null,
        flags: {
          isTechnical: false,
          isCommercial: true,
          isStylobate: true,
          isBasement: false,
          isAttic: false,
          isLoft: false,
          isRoof: false,
        },
      });
    } else {
      let type = 'residential';
      if (currentBlock.type === 'Н') type = 'office';
      if (isParking) type = 'parking_floor';
      if (isInfrastructure) type = 'office';

      const isMixed = commFloors.includes(String(i));
      if (currentBlock.type === 'Ж' && isMixed) type = 'mixed';

      list.push({
        id: `floor_${i}`,
        floorKey,
        label: `${i} этаж`,
        index: i,
        type,
        isComm: isMixed || type === 'office',
        sortOrder: i * 10,
        isStylobate: false,
        isSeparator: false,
        isInserted: false,
        parentFloorIndex: null,
        basementId: null,
        flags: {
          isTechnical: false,
          isCommercial: isMixed || type === 'office',
          isStylobate: false,
          isBasement: false,
          isAttic: false,
          isLoft: false,
          isRoof: false,
        },
      });
    }

    if (blockDetails.technicalFloors?.includes(i)) {
      const isTechMixed = commFloors.includes(`${i}-Т`);
      list.push({
        id: `floor_${i}_tech`,
        floorKey: `tech:${i}`,
        label: `${i}-Т (Технический)`,
        index: i,
        type: 'technical',
        isComm: isTechMixed,
        sortOrder: i * 10 + 5,
        isStylobate: false,
        isSeparator: false,
        isInserted: true,
        parentFloorIndex: i,
        basementId: null,
        flags: {
          isTechnical: true,
          isCommercial: isTechMixed,
          isStylobate: false,
          isBasement: false,
          isAttic: false,
          isLoft: false,
          isRoof: false,
        },
      });
    }
  }

  const extraTechs = (blockDetails.technicalFloors || []).filter(f => Number(f) > end);
  extraTechs.forEach(f => {
    list.push({
      id: `floor_${f}_tech_extra`,
      floorKey: `tech:${f}`,
      label: `${f} (Тех)`,
      index: Number(f),
      type: 'technical',
      isComm: false,
      sortOrder: Number(f) * 10,
      isStylobate: false,
      isSeparator: false,
      isInserted: false,
      parentFloorIndex: Number(f),
      basementId: null,
      flags: {
        isTechnical: true,
        isCommercial: false,
        isStylobate: false,
        isBasement: false,
        isAttic: false,
        isLoft: false,
        isRoof: false,
      },
    });
  });

  if (blockDetails.hasAttic) {
    const isAtticMixed = commFloors.includes('attic');
    list.push({
      id: 'attic',
      floorKey: 'attic',
      label: 'Мансарда',
      index: end + 1,
      type: 'attic',
      isComm: isAtticMixed,
      sortOrder: 50000,
      isStylobate: false,
      isSeparator: false,
      isInserted: false,
      parentFloorIndex: null,
      basementId: null,
      flags: {
        isTechnical: false,
        isCommercial: isAtticMixed,
        isStylobate: false,
        isBasement: false,
        isAttic: true,
        isLoft: false,
        isRoof: false,
      },
    });
  }

  if (blockDetails.hasLoft) {
    const isLoftMixed = commFloors.includes('loft');
    list.push({
      id: 'loft',
      floorKey: 'loft',
      label: 'Чердак',
      index: end + 2,
      type: 'loft',
      isComm: isLoftMixed,
      sortOrder: 55000,
      isStylobate: false,
      isSeparator: false,
      isInserted: false,
      parentFloorIndex: null,
      basementId: null,
      flags: {
        isTechnical: false,
        isCommercial: isLoftMixed,
        isStylobate: false,
        isBasement: false,
        isAttic: false,
        isLoft: true,
        isRoof: false,
      },
    });
  }

  if (blockDetails.hasExploitableRoof) {
    const isRoofMixed = commFloors.includes('roof');
    list.push({
      id: 'roof',
      floorKey: 'roof',
      label: 'Эксплуатируемая кровля',
      index: end + 3,
      type: 'roof',
      isComm: isRoofMixed,
      sortOrder: 60000,
      isStylobate: false,
      isSeparator: false,
      isInserted: false,
      parentFloorIndex: null,
      basementId: null,
      flags: {
        isTechnical: false,
        isCommercial: isRoofMixed,
        isStylobate: false,
        isBasement: false,
        isAttic: false,
        isLoft: false,
        isRoof: true,
      },
    });
  }

  return list.sort((a, b) => a.sortOrder - b.sortOrder);
};
