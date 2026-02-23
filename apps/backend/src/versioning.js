const VERSION_STATUS_FLOW = {
  PENDING: 'PENDING',
  CURRENT: 'CURRENT',
};

const isVersioningEnabled = () => process.env.VERSIONING_ENABLED === 'true';

async function collectProjectVersionEntities(supabase, projectId) {
  const entities = [];

  const { data: projectRow } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (projectRow) entities.push({ entityType: 'project', entityId: projectRow.id, snapshotData: projectRow });

  const { data: buildings = [] } = await supabase.from('buildings').select('*').eq('project_id', projectId);
  for (const row of buildings) entities.push({ entityType: 'building', entityId: row.id, snapshotData: row });

  const buildingIds = buildings.map(b => b.id);
  if (buildingIds.length === 0) return entities;

  const { data: blocks = [] } = await supabase.from('building_blocks').select('*').in('building_id', buildingIds);
  for (const row of blocks) entities.push({ entityType: 'building_block', entityId: row.id, snapshotData: row });

  const blockIds = blocks.map(b => b.id);
  if (blockIds.length === 0) return entities;

  const [
    { data: basements = [] },
    { data: floors = [] },
    { data: entrances = [] },
    { data: blockConstruction = [] },
    { data: blockEngineering = [] },
    { data: blockMarkers = [] },
    { data: entranceMatrix = [] },
  ] = await Promise.all([
    supabase.from('basements').select('*').in('building_id', buildingIds),
    supabase.from('floors').select('*').in('block_id', blockIds),
    supabase.from('entrances').select('*').in('block_id', blockIds),
    supabase.from('block_construction').select('*').in('block_id', blockIds),
    supabase.from('block_engineering').select('*').in('block_id', blockIds),
    supabase.from('block_floor_markers').select('*').in('block_id', blockIds),
    supabase.from('entrance_matrix').select('*').in('block_id', blockIds),
  ]);

  for (const row of basements) entities.push({ entityType: 'basement', entityId: row.id, snapshotData: row });
  for (const row of floors) entities.push({ entityType: 'floor', entityId: row.id, snapshotData: row });
  for (const row of entrances) entities.push({ entityType: 'entrance', entityId: row.id, snapshotData: row });
  for (const row of blockConstruction)
    entities.push({ entityType: 'block_construction', entityId: row.id, snapshotData: row });
  for (const row of blockEngineering)
    entities.push({ entityType: 'block_engineering', entityId: row.id, snapshotData: row });
  for (const row of blockMarkers)
    entities.push({ entityType: 'block_floor_marker', entityId: row.id, snapshotData: row });
  for (const row of entranceMatrix)
    entities.push({ entityType: 'entrance_matrix', entityId: row.id, snapshotData: row });

  const basementIds = basements.map(r => r.id);
  const floorIds = floors.map(r => r.id);

  const [
    { data: basementParkingLevels = [] },
    { data: units = [] },
    { data: commonAreas = [] },
  ] = await Promise.all([
    basementIds.length
      ? supabase.from('basement_parking_levels').select('*').in('basement_id', basementIds)
      : Promise.resolve({ data: [] }),
    floorIds.length ? supabase.from('units').select('*').in('floor_id', floorIds) : Promise.resolve({ data: [] }),
    floorIds.length
      ? supabase.from('common_areas').select('*').in('floor_id', floorIds)
      : Promise.resolve({ data: [] }),
  ]);

  for (const row of basementParkingLevels)
    entities.push({ entityType: 'basement_parking_level', entityId: row.id, snapshotData: row });
  for (const row of units) entities.push({ entityType: 'unit', entityId: row.id, snapshotData: row });
  for (const row of commonAreas)
    entities.push({ entityType: 'common_area', entityId: row.id, snapshotData: row });

  const unitIds = units.map(r => r.id);
  if (unitIds.length) {
    const { data: rooms = [] } = await supabase.from('rooms').select('*').in('unit_id', unitIds);
    for (const row of rooms) entities.push({ entityType: 'room', entityId: row.id, snapshotData: row });
  }

  return entities;
}

export async function createPendingVersionsForApplication({ supabase, projectId, applicationId, createdBy = null }) {
  if (!isVersioningEnabled()) return { ok: true, createdCount: 0, skipped: true };

  const entities = await collectProjectVersionEntities(supabase, projectId);
  let createdCount = 0;

  for (const entity of entities) {
    const { data: versions, error: versionsErr } = await supabase
      .from('object_versions')
      .select('id, version_number, version_status, snapshot_data')
      .eq('entity_type', entity.entityType)
      .eq('entity_id', entity.entityId)
      .order('version_number', { ascending: false });
    if (versionsErr) throw versionsErr;

    const existing = versions || [];
    const hasPending = existing.some(v => v.version_status === VERSION_STATUS_FLOW.PENDING);
    if (hasPending) continue;

    const latestCurrent = existing.find(v => v.version_status === VERSION_STATUS_FLOW.CURRENT);

    const { error: insertErr } = await supabase.from('object_versions').insert({
      entity_type: entity.entityType,
      entity_id: entity.entityId,
      version_number: (existing[0]?.version_number || 0) + 1,
      version_status: VERSION_STATUS_FLOW.PENDING,
      snapshot_data: latestCurrent?.snapshot_data || entity.snapshotData || {},
      created_by: createdBy,
      application_id: applicationId,
      updated_at: new Date().toISOString(),
    });
    if (insertErr) throw insertErr;
    createdCount += 1;
  }

  return { ok: true, createdCount, skipped: false };
}
