/**
 * Утилиты для маппинга данных между БД (Snake_case) и UI (CamelCase/Nested)
 * UPDATED: Fix for 1:1 relations and Parent ID injection
 */

/** @typedef {import('./dto').DbFloorRow} DbFloorRow */
/** @typedef {import('./dto').DbUnitRow} DbUnitRow */
/** @typedef {import('./dto').DbMopRow} DbMopRow */
/** @typedef {import('./dto').UiFloor} UiFloor */
import { normalizeProjectStatusFromDb } from './project-status';

const getOne = val => (Array.isArray(val) ? val[0] || {} : val || {});

const normalizeParkingConstructionFromDb = constructionType => {
  if (constructionType === 'separate' || constructionType === 'integrated') return 'capital';
  return constructionType;
};

// --- 1. PROJECT + APPLICATION ---
export const mapProjectAggregate = (
  project,
  app,
  history = [],
  steps = [],
  parts = [],
  docs = []
) => {
  const completedSteps = steps.filter(s => s.is_completed).map(s => s.step_index);
  const verifiedSteps = steps.filter(s => s.is_verified).map(s => s.step_index);
  const stepBlockStatuses = steps.reduce((acc, stepRow) => {
    if (stepRow?.step_index === undefined) return acc;
    acc[stepRow.step_index] = stepRow.block_statuses || {};
    return acc;
  }, {});

  return {
    id: project.id,
    ujCode: project.uj_code,
    applicationId: app.id,
    name: project.name,
    status: normalizeProjectStatusFromDb(project.construction_status),
    lastModified: app.updated_at,

    applicationInfo: {
      id: app.id,
      internalNumber: app.internal_number,
      externalSource: app.external_source,
      externalId: app.external_id,
      applicant: app.applicant,
      submissionDate: app.submission_date,
      status: app.status,
      workflowSubstatus: app.workflow_substatus || 'DRAFT',
      assigneeName: app.assignee_name,
      currentStepIndex: app.current_step,
      currentStage: app.current_stage,
      completedSteps,
      verifiedSteps,
      requestedDeclineReason: app.requested_decline_reason || null,
      requestedDeclineStep: app.requested_decline_step ?? null,
      requestedDeclineBy: app.requested_decline_by || null,
      requestedDeclineAt: app.requested_decline_at || null,
      stepBlockStatuses,
      history: history
        .map(h => ({
          date: h.created_at,
          user: h.user_name,
          action: h.action,
          status: h.next_status,
          comment: h.comment,
          prevStatus: h.prev_status,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    },

    complexInfo: {
      name: project.name,
      ujCode: project.uj_code,
      status: normalizeProjectStatusFromDb(project.construction_status),
      region: project.region,
      district: project.district,
      street: project.address,
      landmark: project.landmark,
      dateStartProject: project.date_start_project,
      dateEndProject: project.date_end_project,
      dateStartFact: project.date_start_fact,
      dateEndFact: project.date_end_fact,
    },

    participants: parts.reduce((acc, part) => {
      acc[part.role] = { id: part.id, name: part.name, inn: part.inn, role: part.role };
      return acc;
    }, {}),

    cadastre: { number: project.cadastre_number },

    documents: docs.map(d => ({
      id: d.id,
      name: d.name,
      type: d.doc_type,
      date: d.doc_date,
      number: d.doc_number,
      url: d.file_url,
    })),
  };
};

// --- 2. BUILDINGS ---
export const mapBuildingFromDB = (b, blocks = []) => {
  const activeBlocks = (blocks || []).filter(bl => !bl.is_basement_block);
  const resBlocksCount = activeBlocks.filter(bl => bl.type === 'Ж').length;
  const nonResBlocksCount = activeBlocks.filter(bl => bl.type === 'Н').length;

  return {
    id: b.id,
    buildingCode: b.building_code,
    label: b.label,
    houseNumber: b.house_number,
    category: b.category,
    type: mapCategoryToLabel(b.category),
    stage: 'Проектный',
    resBlocks: resBlocksCount,
    nonResBlocks: nonResBlocksCount,
    parkingType: b.parking_type,
    constructionType: normalizeParkingConstructionFromDb(b.construction_type),
    infraType: b.infra_type,
    hasNonResPart: b.has_non_res_part ?? nonResBlocksCount > 0,
    blocks: activeBlocks.map(bl => ({
      id: bl.id,
      buildingId: b.id,
      label: bl.label,
      type: mapDBTypeToUI(bl.type),
      index: 0,
    })),
  };
};

// --- 3. DETAILS (BLOCK CONFIG) ---
export const mapBlockDetailsFromDB = (b, block, blockMarkers = []) => {
  const constr = getOne(block.block_construction);
  const eng = getOne(block.block_engineering);

  const technicalFloors = [];
  const commercialFloors = [];
  
  // УНИВЕРСАЛЬНЫЙ ПОИСК МАРКЕРОВ: 
  // Берем из общего массива (если пришел) ИЛИ из вложенного объекта блока (часто в Supabase)
  const markers = [
    ...(Array.isArray(blockMarkers) ? blockMarkers : []),
    ...(Array.isArray(block.block_floor_markers) ? block.block_floor_markers : [])
  ];

  markers.forEach(m => {
    // Проверяем принадлежность к блоку (если маркер вложенный, block_id может не быть, считаем его валидным)
    if (!m.block_id || m.block_id === block.id) {
       
       if (m.is_technical) {
          const techVal = m.floor_index ?? m.marker_key;
          if (techVal !== null && techVal !== undefined) {
             technicalFloors.push(String(techVal)); // Принудительно в строку
          }
       }
       
       if (m.is_commercial) {
          const commVal = m.marker_key ?? m.floor_index;
          if (commVal !== null && commVal !== undefined) {
             commercialFloors.push(String(commVal)); // Принудительно в строку
          }
       }
    }
  });

  
  return {
    floorsCount: block.floors_count || 0,
    entrances: block.entrances_count || 0,
    inputs: block.entrances_count || 0,
    elevators: block.elevators_count || 0,
    vehicleEntries: block.vehicle_entries || 0,
    levelsDepth: block.levels_depth || 0,
    lightStructureType: block.light_structure_type || '',
    parentBlocks: block.parent_blocks || [],
    floorsFrom: block.floors_from || 1,
    floorsTo: block.floors_to || block.floors_count || 1,

    hasBasementFloor: !!block.has_basement,
    hasAttic: !!block.has_attic,
    hasLoft: !!block.has_loft,
    hasExploitableRoof: !!block.has_roof_expl,

    hasCustomAddress: block.has_custom_address,
    customHouseNumber: block.custom_house_number,

    foundation: constr.foundation || '',
    walls: constr.walls || '',
    slabs: constr.slabs || '',
    roof: constr.roof || '',
    seismicity: constr.seismicity ? parseInt(constr.seismicity) : 0,

    engineering: {
      electricity: !!eng.has_electricity,
      hvs: !!eng.has_water,
      gvs: !!eng.has_hot_water,
      sewerage: !!eng.has_sewerage,
      gas: !!eng.has_gas,
      heating: !!eng.has_heating,
      ventilation: !!eng.has_ventilation,
      firefighting: !!eng.has_firefighting,
      lowcurrent: !!eng.has_lowcurrent,
    },

    technicalFloors,
    commercialFloors,
  };
};

export const mapFloorFromDB = (f, buildingId, blockId) => ({
  id: f.id,
  buildingId, 
  blockId, 
  floorKey: f.floor_key,
  label: f.label,
  type: f.floor_type,
  index: f.index,
  height: f.height,
  areaProj: f.area_proj,
  areaFact: f.area_fact,
  isDuplex: f.is_duplex,
  isComm: !!f.is_commercial,
  isCommercial: !!f.is_commercial,
  sortOrder: f.index,
  parentFloorIndex: f.parent_floor_index,
  basementId: f.basement_id,
  flags: {
    isTechnical: !!f.is_technical,
    isCommercial: !!f.is_commercial,
    isStylobate: !!f.is_stylobate,
    isBasement: !!f.is_basement,
    isAttic: !!f.is_attic,
    isLoft: !!f.is_loft,
    isRoof: !!f.is_roof,
  },
});

export const mapUnitFromDB = (u, rooms = [], entranceMap = {}, buildingId, blockId) => ({
  id: u.id,
  unitCode: u.unit_code,
  buildingId, 
  blockId, 
  num: u.number,
  number: u.number,
  type: u.unit_type || 'flat',
  hasMezzanine: !!u.has_mezzanine,
  mezzanineType: u.mezzanine_type || null,
  area: u.total_area,
  livingArea: u.living_area,
  usefulArea: u.useful_area,
  rooms: u.rooms_count,
  isSold: u.status === 'sold',
  cadastreNumber: u.cadastre_number,
  floorId: u.floor_id,
  entranceIndex: u.entrance_id ? entranceMap[u.entrance_id] || 1 : 1,
  entranceId: u.entrance_id,
  explication: rooms.map(r => ({
    id: r.id,
    type: r.room_type,
    label: r.name,
    area: r.area,
    height: r.room_height,
    level: r.level,
    isMezzanine: !!r.is_mezzanine,
  })),
});

export const mapMopFromDB = (m, entranceMap = {}, buildingId, blockId) => ({
  id: m.id,
  buildingId,
  blockId,
  type: m.type,
  area: m.area,
  height: m.height,
  floorId: m.floor_id,
  entranceIndex: m.entrance_id ? entranceMap[m.entrance_id] || 1 : 1,
  entranceId: m.entrance_id,
});

function mapCategoryToLabel(cat) {
  const map = {
    residential: 'Жилой дом',
    residential_multiblock: 'Жилой дом (многоблочный)',
    parking_separate: 'Паркинг',
    infrastructure: 'Инфраструктура',
  };
  return map[cat] || 'Объект';
}

function mapDBTypeToUI(dbType) {
  if (dbType === 'Ж') return 'residential';
  if (dbType === 'Н') return 'non_residential';
  if (dbType === 'Parking') return 'parking';
  if (dbType === 'Infra') return 'infrastructure';
  if (dbType === 'BAS') return 'basement';
  return dbType;
}