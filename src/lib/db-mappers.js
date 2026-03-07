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


const mapExtensionFromDB = extension => ({
  id: extension.id,
  parentBlockId: extension.parent_block_id,
  buildingId: extension.building_id,
  label: extension.label,
  extensionType: extension.extension_type || 'OTHER',
  constructionKind: extension.construction_kind || 'capital',
  floorsCount: extension.floors_count || 1,
  startFloorIndex: extension.start_floor_index || 1,
  verticalAnchorType: extension.vertical_anchor_type || 'GROUND',
  anchorFloorKey: extension.anchor_floor_key || null,
  notes: extension.notes || null,
});

// --- 1. PROJECT + APPLICATION ---
export const mapProjectAggregate = (
  project,
  app = {}, // добавили = {} для защиты от null
  history = [],
  steps = [],
  parts = [],
  docs = []
) => {
  const completedSteps = steps.filter(s => s.is_completed || s.isCompleted).map(s => s.step_index ?? s.stepIndex);
  const verifiedSteps = steps.filter(s => s.is_verified || s.isVerified).map(s => s.step_index ?? s.stepIndex);
  const stepBlockStatuses = steps.reduce((acc, stepRow) => {
    const idx = stepRow?.step_index ?? stepRow?.stepIndex;
    if (idx === undefined) return acc;
    acc[idx] = stepRow.block_statuses || stepRow.blockStatuses || {};
    return acc;
  }, {});

  return {
    id: project.id,
    ujCode: project.uj_code || project.ujCode,
    applicationId: app.id,
    name: project.name,
    status: normalizeProjectStatusFromDb(project.construction_status || project.constructionStatus),
    lastModified: app.updated_at || app.updatedAt,

    applicationInfo: {
      id: app.id,
      internalNumber: app.internal_number || app.internalNumber,
      externalSource: app.external_source || app.externalSource,
      externalId: app.external_id || app.externalId,
      applicant: app.applicant,
      submissionDate: app.submission_date || app.submissionDate,
      status: app.status,
      workflowSubstatus: app.workflow_substatus || app.workflowSubstatus || 'DRAFT',
      assigneeName: app.assignee_name || app.assigneeName,
      currentStepIndex: app.current_step ?? app.currentStep,
      currentStage: app.current_stage || app.currentStage,
      completedSteps,
      verifiedSteps,
      requestedDeclineReason: app.requested_decline_reason || app.requestedDeclineReason || null,
      requestedDeclineStep: app.requested_decline_step ?? app.requestedDeclineStep ?? null,
      requestedDeclineBy: app.requested_decline_by || app.requestedDeclineBy || null,
      requestedDeclineAt: app.requested_decline_at || app.requestedDeclineAt || null,
      stepBlockStatuses,
      history: history
        .map(h => ({
          date: h.created_at || h.createdAt,
          user: h.user_name || h.userName,
          action: h.action,
          status: h.next_status || h.nextStatus,
          comment: h.comment,
          prevStatus: h.prev_status || h.prevStatus,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    },

    complexInfo: {
      name: project.name,
      ujCode: project.uj_code || project.ujCode,
      status: normalizeProjectStatusFromDb(project.construction_status || project.constructionStatus),
      region: project.region,
      district: project.district,
      street: project.address,
      regionSoato: project.region_soato || project.regionSoato || '',
      districtSoato: project.district_soato || project.districtSoato || '',
      streetId: project.street_id || project.streetId || '',
      mahallaId: project.mahalla_id || project.mahallaId || '',
      mahalla: project.mahalla || '',
      buildingNo: project.building_no || project.buildingNo || '',
      landmark: project.landmark,
      addressId: project.address_id || project.addressId || null,
      dateStartProject: project.date_start_project || project.dateStartProject,
      dateEndProject: project.date_end_project || project.dateEndProject,
      dateStartFact: project.date_start_fact || project.dateStartFact,
      dateEndFact: project.date_end_fact || project.dateEndFact,
    },

    participants: parts.reduce((acc, part) => {
      acc[part.role] = { id: part.id, name: part.name, inn: part.inn, role: part.role };
      return acc;
    }, {}),

    cadastre: { 
        number: project.cadastre_number || project.cadastreNumber, 
        area: project.land_plot_area_m2 || project.landPlotAreaM2 
    },
    landPlot: { 
        geometry: project.land_plot_geojson || project.landPlotGeojson || null, 
        areaM2: project.land_plot_area_m2 || project.landPlotAreaM2 || null 
    },

    documents: docs.map(d => ({
      id: d.id,
      name: d.name,
      type: d.doc_type || d.docType,
      date: d.doc_date || d.docDate,
      number: d.doc_number || d.docNumber,
      url: d.file_url || d.fileUrl,
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
    addressId: b.address_id || null,
    effectiveAddressId: b.effective_address_id || b.address_id || null,
    category: b.category,
    type: mapCategoryToLabel(b.category),
    stage: 'Проектный',
    resBlocks: resBlocksCount,
    nonResBlocks: nonResBlocksCount,
    parkingType: b.parking_type,
    constructionType: normalizeParkingConstructionFromDb(b.construction_type),
    infraType: b.infra_type,
    hasNonResPart: b.has_non_res_part ?? nonResBlocksCount > 0,
    geometry: b.footprint_geojson || null,
    blocks: (blocks || []).map(bl => ({
      id: bl.id,
      buildingId: b.id,
      label: bl.label,
      type: mapDBTypeToUI(bl.type),
      index: 0,
      isBasementBlock: !!bl.is_basement_block,
      linkedBlockIds: Array.isArray(bl.linked_block_ids) ? bl.linked_block_ids : [],
      extensions: (Array.isArray(bl.block_extensions) ? bl.block_extensions : []).map(mapExtensionFromDB),
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
    addressId: block.address_id || null,
    effectiveAddressId: block.effective_address_id || block.address_id || null,
    blockGeometry: block.footprint_geojson || null,

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
      heatingLocal: !!eng.has_heating_local,
      heatingCentral: !!eng.has_heating_central,
      heating: !!eng.has_heating_local || !!eng.has_heating_central || !!eng.has_heating,
      ventilation: !!eng.has_ventilation,
      firefighting: !!eng.has_firefighting,
      lowcurrent: !!eng.has_lowcurrent,
      internet: !!eng.has_internet,
      solarPanels: !!eng.has_solar_panels,
    },

    technicalFloors,
    commercialFloors,
  };
};

export const mapFloorFromDB = (f, buildingId, blockId) => ({
  id: f.id,
  buildingId,
  blockId,
  extensionId: f.extension_id ?? f.extensionId ?? null,
  floorKey: f.floor_key ?? f.floorKey,
  label: f.label,
  type: f.floor_type ?? f.floorType,
  index: f.index ?? f.floor_index,
  height: f.height,
  areaProj: f.area_proj ?? f.areaProj,
  areaFact: f.area_fact ?? f.areaFact,
  isDuplex: f.is_duplex ?? f.isDuplex,
  isComm: !!(f.is_commercial ?? f.isCommercial),
  isCommercial: !!(f.is_commercial ?? f.isCommercial),
  sortOrder: f.index ?? f.floor_index,
  parentFloorIndex: f.parent_floor_index ?? f.parentFloorIndex,
  basementId: f.basement_id ?? f.basementId,
  flags: {
    isTechnical: !!(f.is_technical ?? f.isTechnical),
    isCommercial: !!(f.is_commercial ?? f.isCommercial),
    isStylobate: !!(f.is_stylobate ?? f.isStylobate),
    isBasement: !!(f.is_basement ?? f.isBasement),
    isAttic: !!(f.is_attic ?? f.isAttic),
    isLoft: !!(f.is_loft ?? f.isLoft),
    isRoof: !!(f.is_roof ?? f.isRoof),
  },
});

export const mapUnitFromDB = (u, rooms = [], entranceMap = {}, buildingId, blockId) => ({
  id: u.id,
  unitCode: u.unit_code,
  buildingId,
  blockId,
  extensionId: u.extension_id || null,
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
  addressId: u.address_id || null,
  effectiveAddressId: u.effective_address_id || u.address_id || null,
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
