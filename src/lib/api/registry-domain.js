export const createRegistryDomainApi = ({
  BffClient,
  requireBffEnabled,
  resolveActor,
  createIdempotencyKey,
  mapFloorFromDB,
  mapUnitFromDB,
  mapMopFromDB,
}) => ({
  getBuildingsRegistrySummary: async () => {
    requireBffEnabled('registry.getBuildingsRegistrySummary');
    return BffClient.getRegistryBuildingsSummary();
  },

  getBuildings: async projectId => {
    requireBffEnabled('project.getBuildings');
    return BffClient.getBuildings({ projectId });
  },

  createBuilding: async (projectId, buildingData, blocksData, actor = {}) => {
    requireBffEnabled('project.createBuilding');

    const resolvedActor = resolveActor(actor);
    return BffClient.createBuilding({
      projectId,
      buildingData,
      blocksData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  updateBuilding: async (buildingId, buildingData, actor = {}, blocksData = null) => {
    requireBffEnabled('project.updateBuilding');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateBuilding({
      buildingId,
      buildingData,
      blocksData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  deleteBuilding: async (buildingId, actor = {}) => {
    requireBffEnabled('project.deleteBuilding');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteBuilding({
      buildingId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  getBlockExtensions: async blockId => {
    requireBffEnabled('extensions.getBlockExtensions');
    return BffClient.getBlockExtensions({ blockId });
  },

  createBlockExtension: async (blockId, extensionData, actor = {}) => {
    requireBffEnabled('extensions.createBlockExtension');

    const resolvedActor = resolveActor(actor);
    return BffClient.createBlockExtension({
      blockId,
      extensionData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('extensions-create', [blockId]),
    });
  },

  updateBlockExtension: async (extensionId, extensionData, actor = {}) => {
    requireBffEnabled('extensions.updateBlockExtension');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateBlockExtension({
      extensionId,
      extensionData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('extensions-update', [extensionId]),
    });
  },

  deleteBlockExtension: async (extensionId, actor = {}) => {
    requireBffEnabled('extensions.deleteBlockExtension');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteBlockExtension({
      extensionId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('extensions-delete', [extensionId]),
    });
  },

  getFloors: async blockId => {
    requireBffEnabled('composition.getFloors');
    const data = await BffClient.getFloors({ blockId });
    return (data || []).map(f => mapFloorFromDB(f, null, blockId));
  },

  updateFloor: async (floorId, updates, actor = {}) => {
    requireBffEnabled('composition.updateFloor');

    const resolvedActor = resolveActor(actor);
    return BffClient.updateFloor({
      floorId,
      updates,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  generateFloors: async (blockId, floorsFrom, floorsTo, defaultType = 'residential', actor = {}) => {
    requireBffEnabled('composition.generateFloors');

    const resolvedActor = resolveActor(actor);
    return BffClient.reconcileFloors({
      blockId,
      floorsFrom,
      floorsTo,
      defaultType,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('reconcile-floors', [blockId]),
    });
  },

  getEntrances: async blockId => {
    requireBffEnabled('matrix.getEntrances');
    return BffClient.getEntrances({ blockId });
  },

  getMatrix: async blockId => {
    requireBffEnabled('matrix.getMatrix');

    const data = await BffClient.getEntranceMatrix({ blockId });
    const map = {};
    (data || []).forEach(row => {
      map[`${row.floor_id}_${row.entrance_number}`] = {
        id: row.id,
        apts: row.flats_count,
        units: row.commercial_count,
        mopQty: row.mop_count,
      };
    });
    return map;
  },

  upsertMatrixCell: async (blockId, floorId, entranceNumber, values, actor = {}) => {
    requireBffEnabled('matrix.upsertMatrixCell');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertMatrixCell({
      blockId,
      floorId,
      entranceNumber,
      values,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  syncEntrances: async (blockId, count, actor = {}) => {
    requireBffEnabled('matrix.syncEntrances');

    const resolvedActor = resolveActor(actor);
    return BffClient.reconcileEntrances({
      blockId,
      count,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('reconcile-entrances', [blockId]),
    });
  },

  getUnitExplicationById: async unitId => {
    requireBffEnabled('units.getUnitExplicationById');

    const data = await BffClient.getUnitExplicationById({ unitId });
    if (!data) return null;

    return {
      id: data.id,
      unitCode: data.unit_code,
      number: data.number,
      num: data.number,
      type: data.unit_type,
      hasMezzanine: !!data.has_mezzanine,
      mezzanineType: data.mezzanine_type || null,
      area: data.total_area,
      livingArea: data.living_area,
      usefulArea: data.useful_area,
      rooms: data.rooms_count,
      floorId: data.floor_id,
      entranceId: data.entrance_id,
      explication: (data.rooms || []).map(r => ({
        id: r.id,
        type: r.room_type,
        label: r.name,
        area: r.area,
        height: r.room_height,
        level: r.level,
        isMezzanine: !!r.is_mezzanine,
      })),
    };
  },

  getUnits: async (blockId, options = {}) => {
    requireBffEnabled('units.getUnits');

    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];
    const payload = await BffClient.getUnits({ blockId, floorIds: extraFloorIds });
    const units = payload?.units || [];
    const entranceMap = payload?.entranceMap || {};

    return units.map(u => ({
      ...mapUnitFromDB(u, u.rooms, entranceMap, null, blockId),
      entranceIndex: u.entrance_id ? entranceMap[u.entrance_id] || 1 : u.entrance_index || 1,
    }));
  },

  upsertUnit: async (unitData, actor = {}) => {
    requireBffEnabled('units.upsertUnit');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertUnit({
      unitData,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  getCommonAreas: async (blockId, options = {}) => {
    requireBffEnabled('commonAreas.getCommonAreas');

    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];
    const data = await BffClient.getCommonAreas({ blockId, floorIds: extraFloorIds });
    return (data || []).map(m => mapMopFromDB(m, {}, null, blockId));
  },

  upsertCommonArea: async (data, actor = {}) => {
    requireBffEnabled('commonAreas.upsertCommonArea');

    const resolvedActor = resolveActor(actor);
    return BffClient.upsertCommonArea({
      data,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  deleteCommonArea: async (id, actor = {}) => {
    requireBffEnabled('commonAreas.deleteCommonArea');

    const resolvedActor = resolveActor(actor);
    return BffClient.deleteCommonArea({
      id,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  clearCommonAreas: async (blockId, options = {}, actor = {}) => {
    requireBffEnabled('commonAreas.clearCommonAreas');

    const extraFloorIds = Array.isArray(options?.floorIds) ? options.floorIds.filter(Boolean) : [];
    const resolvedActor = resolveActor(actor);
    return BffClient.clearCommonAreas({
      blockId,
      floorIds: extraFloorIds,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  reconcileUnitsForBlock: async (blockId, actor = {}) => {
    requireBffEnabled('units.reconcileUnitsForBlock');

    const resolvedActor = resolveActor(actor);
    return BffClient.reconcileUnitsForBlock({
      blockId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('reconcile-units', [blockId]),
    });
  },

  reconcileCommonAreasForBlock: async (blockId, actor = {}) => {
    requireBffEnabled('commonAreas.reconcileCommonAreasForBlock');

    const resolvedActor = resolveActor(actor);
    return BffClient.reconcileCommonAreasForBlock({
      blockId,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('reconcile-mops', [blockId]),
    });
  },

  getBasements: async projectId => {
    requireBffEnabled('basements.getBasements');
    return BffClient.getBasements({ projectId });
  },

  toggleBasementLevel: async (basementId, level, isEnabled, actor = {}) => {
    requireBffEnabled('basements.toggleBasementLevel');

    const resolvedActor = resolveActor(actor);
    return BffClient.toggleBasementLevel({
      basementId,
      level,
      isEnabled,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
    });
  },

  getParkingCounts: async projectId => {
    requireBffEnabled('basements.getParkingCounts');
    return BffClient.getParkingCounts({ projectId });
  },

  syncParkingPlaces: async (floorId, targetCount, _buildingId, actor = {}) => {
    requireBffEnabled('basements.syncParkingPlaces');

    const resolvedActor = resolveActor(actor);
    return BffClient.syncParkingPlaces({
      floorId,
      targetCount,
      userName: resolvedActor.userName,
      userRole: resolvedActor.userRole,
      idempotencyKey: createIdempotencyKey('sync-parking', [floorId]),
    });
  },
});
