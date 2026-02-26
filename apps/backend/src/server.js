import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getConfig } from './config.js';
import { createSupabaseAdminClient } from './supabase.js';
import { registerCompositionRoutes } from './composition-routes.js';
import { registerRegistryRoutes } from './registry-routes.js';
import { registerIntegrationRoutes } from './integration-routes.js';
import { registerProjectRoutes } from './project-routes.js';
import { createIdempotencyStore } from './idempotency-store.js';
import { installAuthMiddleware } from './auth.js';
import { sendError, requirePolicyActor } from './http-helpers.js';
import { registerAuthRoutes } from './auth-routes.js';

const INTEGRATION_START_IDX = 12;
const LAST_STEP_INDEX_BY_STAGE = {
  1: 5,
  2: 8,
  3: 11,
  4: 13,
};
const TOTAL_STEPS = 14;

const ALLOWED_CATALOG_TABLES = [
  'dict_project_statuses',
  'dict_application_statuses',
  'dict_external_systems',
  'dict_foundations',
  'dict_wall_materials',
  'dict_slab_types',
  'dict_roof_types',
  'dict_light_structure_types',
  'dict_parking_types',
  'dict_parking_construction_types',
  'dict_infra_types',
  'dict_mop_types',
  'dict_unit_types',
  'dict_room_types',
  'dict_system_users',
];

function buildCompletionTransition(current) {
  const currentStep = Number(current.current_step || 0);
  const currentStage = Number(current.current_stage || 1);
  const nextStepIndex = currentStep + 1;
  const stageBoundary = LAST_STEP_INDEX_BY_STAGE[currentStage] === currentStep;
  const isLastStepGlobal = nextStepIndex >= TOTAL_STEPS;

  let nextStatus = current.status || 'IN_PROGRESS';
  let nextSubstatus = current.workflow_substatus || 'DRAFT';
  let nextStage = currentStage;

  if (isLastStepGlobal) {
    nextStatus = 'COMPLETED';
    nextSubstatus = 'DONE';
  } else if (stageBoundary) {
    nextStatus = 'IN_PROGRESS';
    nextSubstatus = 'REVIEW';
    nextStage = currentStage + 1;
  } else if (nextStepIndex === INTEGRATION_START_IDX) {
    nextStatus = 'IN_PROGRESS';
    nextSubstatus = 'INTEGRATION';
  } else {
    nextStatus = 'IN_PROGRESS';
    if (nextSubstatus !== 'INTEGRATION') nextSubstatus = 'DRAFT';
  }

  return { nextStepIndex, nextStatus, nextSubstatus, nextStage };
}

function buildRollbackTransition(current) {
  const currentStep = Number(current.current_step || 0);
  const prevIndex = Math.max(0, currentStep - 1);
  const currentSubstatus = current.workflow_substatus || 'DRAFT';

  let nextSubstatus = currentSubstatus;
  if (currentSubstatus === 'REVIEW' || currentSubstatus === 'DONE') {
    nextSubstatus = 'DRAFT';
  }

  return {
    nextStepIndex: prevIndex,
    nextStage: Number(current.current_stage || 1),
    nextStatus: 'IN_PROGRESS',
    nextSubstatus,
  };
}

function buildReviewTransition(current, action) {
  const isApprove = action === 'APPROVE';
  const currentStage = Number(current.current_stage || 1);
  let nextStatus = current.status || 'IN_PROGRESS';
  let nextSubstatus = current.workflow_substatus || 'DRAFT';
  let nextStepIndex = Number(current.current_step || 0);
  let nextStage = currentStage;

  if (isApprove) {
    nextSubstatus = 'DRAFT';
    if (nextStepIndex === INTEGRATION_START_IDX) nextSubstatus = 'INTEGRATION';
    nextStatus = 'IN_PROGRESS';
  } else {
    nextStage = Math.max(1, currentStage - 1);
    nextStepIndex = LAST_STEP_INDEX_BY_STAGE[nextStage] ?? 0;
    nextSubstatus = 'REVISION';
    nextStatus = 'IN_PROGRESS';
  }

  return { isApprove, nextStatus, nextSubstatus, nextStepIndex, nextStage };
}

export function getStageStepRange(stage) {
  const normalizedStage = Number(stage || 1);
  const rangeEnd = LAST_STEP_INDEX_BY_STAGE[normalizedStage];
  if (!Number.isInteger(rangeEnd) || rangeEnd < 0) return null;

  const prevStage = normalizedStage - 1;
  const prevEnd = prevStage >= 1 ? LAST_STEP_INDEX_BY_STAGE[prevStage] : -1;
  const rangeStart = Number.isInteger(prevEnd) ? prevEnd + 1 : 0;

  return { start: rangeStart, end: rangeEnd };
}

function buildIdempotencyContext(req, actor) {
  const rawKey = req.headers['x-idempotency-key'];
  if (!rawKey) return null;

  const idempotencyKey = String(rawKey).trim();
  if (!idempotencyKey) return null;

  const scope = req.routeOptions?.url || req.url || 'unknown';
  const actorScope = actor?.userId || 'anonymous';
  const bodyFingerprint = JSON.stringify(req.body ?? null);

  return {
    cacheKey: `${scope}:${actorScope}:${idempotencyKey}`,
    fingerprint: `${req.method}:${scope}:${bodyFingerprint}`,
  };
}

function tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply) {
  if (!idempotencyContext) return false;

  const state = idempotencyStore.get(idempotencyContext.cacheKey, idempotencyContext.fingerprint);
  if (state.status === 'hit') {
    reply.send(state.value);
    return true;
  }

  if (state.status === 'conflict') {
    sendError(reply, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different payload');
    return true;
  }

  return false;
}

function rememberIdempotentResponse(idempotencyStore, idempotencyContext, payload) {
  if (!idempotencyContext) return;
  idempotencyStore.set(idempotencyContext.cacheKey, idempotencyContext.fingerprint, payload);
}

async function ensureActorLock(supabase, applicationId, actorUserId) {
  const { data: lockData, error: lockError } = await supabase
    .from('application_locks')
    .select('owner_user_id, expires_at')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (lockError) return { ok: false, status: 500, code: 'DB_ERROR', message: lockError.message };
  if (!lockData || lockData.owner_user_id !== actorUserId || new Date(lockData.expires_at) <= new Date()) {
    return {
      ok: false,
      status: 423,
      code: 'LOCK_REQUIRED',
      message: 'Active lock owned by current user is required',
    };
  }

  return { ok: true };
}

async function getApplication(supabase, applicationId) {
  const { data: appRow, error } = await supabase
    .from('applications')
    .select('id, status, workflow_substatus, current_step, current_stage')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  if (!appRow) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Application not found' };

  return { ok: true, appRow };
}

async function addHistory(supabase, { applicationId, action, prevStatus, nextStatus, userName, comment }) {
  const { data, error } = await supabase
    .from('application_history')
    .insert({
      application_id: applicationId,
      action,
      prev_status: prevStatus,
      next_status: nextStatus,
      user_name: userName,
      comment,
    })
    .select('id')
    .single();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true, historyEventId: data.id };
}

async function updateApplicationState(supabase, applicationId, transition) {
  const { data, error } = await supabase
    .from('applications')
    .update({
      status: transition.nextStatus,
      workflow_substatus: transition.nextSubstatus,
      current_step: transition.nextStepIndex,
      current_stage: transition.nextStage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select('id, status, workflow_substatus, current_step, current_stage')
    .single();

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true, updatedApp: data };
}

export async function updateStepCompletion(supabase, { applicationId, stepIndex, isCompleted }) {
  const payload = {
    application_id: applicationId,
    step_index: Number(stepIndex),
    is_completed: Boolean(isCompleted),
  };

  const { error } = await supabase
    .from('application_steps')
    .upsert(payload, { onConflict: 'application_id,step_index' });

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true };
}

export async function updateStageVerification(supabase, { applicationId, stage, isVerified }) {
  const range = getStageStepRange(stage);
  if (!range) {
    return { ok: false, status: 400, code: 'INVALID_STAGE', message: `Cannot resolve step range for stage ${stage}` };
  }

  const payload = [];
  for (let stepIdx = range.start; stepIdx <= range.end; stepIdx += 1) {
    payload.push({
      application_id: applicationId,
      step_index: stepIdx,
      is_verified: Boolean(isVerified),
    });
  }

  const { error } = await supabase
    .from('application_steps')
    .upsert(payload, { onConflict: 'application_id,step_index' });

  if (error) return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
  return { ok: true };
}


function buildValidationError(code, message, meta = {}) {
  return { code, message, meta };
}

async function buildStepValidationResult(supabase, { projectId, stepId }) {
  const normalizedStepId = String(stepId || '').trim();
  const errors = [];

  const { data: buildings, error: buildingsError } = await supabase
    .from('buildings')
    .select(`
      id, label, category, construction_type, parking_type, infra_type, has_non_res_part,
      building_blocks (
        id, label, type, floors_from, floors_to, floors_count, entrances_count,
        elevators_count, levels_depth, vehicle_entries, light_structure_type,
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

  // 1. Шаг "Состав объектов"
  if (normalizedStepId === 'composition') {
    const hasResidential = allBuildings.some(b => b.category?.includes('residential'));
    if (!hasResidential) {
      errors.push(buildValidationError('NO_RESIDENTIAL', 'В проекте отсутствует жилой дом. Необходимо добавить хотя бы один объект типа "Жилой дом" или "Многоблочный".'));
    }
  }

  // 2. Шаг "Нежилые блоки и инфраструктура" (ИСПРАВЛЕНО: добавлена логика)
  if (normalizedStepId === 'registry_nonres') {
    allBuildings.forEach(building => {
      const isParking = building.category === 'parking_separate';
      const isInfra = building.category === 'infrastructure';
      const isUnderground = building.parking_type === 'underground' || building.construction_type === 'underground';

      // Для этого шага нужны только нежилые блоки
      const nonResBlocks = (building.building_blocks || []).filter(blk => blk.type !== 'Ж');

      nonResBlocks.forEach(block => {
        const title = `Объект: ${building.label} (Блок: ${block.label || 'Основной блок'})`;
        const constr = Array.isArray(block.block_construction) ? block.block_construction[0] : block.block_construction;

        if (isInfra) {
          // Проверки инфраструктуры
          if (!block.floors_count) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Количество этажей" обязательно`));
          if (!block.entrances_count) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Количество входов" обязательно`));
          if (!constr?.foundation) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Фундамент" обязательно`));
          if (!constr?.walls) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Материал стен" обязательно`));
          if (!constr?.slabs) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Перекрытия" обязательно`));
          if (!constr?.roof) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Кровля" обязательно`));
          if (constr?.seismicity === null || constr?.seismicity === undefined) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Сейсмичность" обязательно`));
        } else if (isParking) {
          // Проверки паркингов
          if (building.construction_type === 'capital') {
            if (!constr?.foundation) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Фундамент" обязательно`));
            if (!constr?.walls) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Материал стен" обязательно`));
            if (!constr?.slabs) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Перекрытия" обязательно`));
            if (!constr?.roof) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Кровля" обязательно`));
            if (constr?.seismicity === null || constr?.seismicity === undefined) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Сейсмичность" обязательно`));
            if (!block.vehicle_entries) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Въезды" обязательно`));
            if (!block.entrances_count) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Количество входов" обязательно`));

            if (isUnderground) {
              if (!block.levels_depth) errors.push(buildValidationError('MISSING_FIELD', `${title}: Не указана глубина подземного паркинга.`));
            } else {
              if (!block.floors_count) errors.push(buildValidationError('MISSING_FIELD', `${title}: Не указано количество этажей паркинга.`));
            }
          } else if (building.construction_type === 'light') {
            if (!block.light_structure_type) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Тип конструкции" обязательно для легкого паркинга`));
          }
        }
      });
    });
  }

  // 3. Шаг "Жилые блоки"
  if (normalizedStepId === 'registry_res') {
    const resBuildings = allBuildings.filter(b => b.category?.includes('residential'));
    resBuildings.forEach(building => {
      const blocks = (building.building_blocks || []).filter(blk => blk.type === 'Ж');
      if (blocks.length === 0) {
        errors.push(buildValidationError('NO_BLOCKS', `Объект "${building.label}": нет жилых блоков.`));
        return;
      }

      blocks.forEach(block => {
        const title = `Объект: ${building.label} (Блок: ${block.label || 'Основной'})`;
        const constr = Array.isArray(block.block_construction) ? block.block_construction[0] : block.block_construction;
        const eng = Array.isArray(block.block_engineering) ? block.block_engineering[0] : block.block_engineering;

        if (!constr?.foundation) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Фундамент" обязательно`));
        if (!constr?.walls) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Материал стен" обязательно`));
        if (!constr?.slabs) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Перекрытия" обязательно`));
        if (!constr?.roof) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Кровля" обязательно`));
        if (constr?.seismicity === null || constr?.seismicity === undefined) errors.push(buildValidationError('MISSING_FIELD', `${title}: Поле "Сейсмичность" обязательно`));

        if (!block.entrances_count) errors.push(buildValidationError('MISSING_FIELD', `${title}: Не указано количество подъездов`));
        if (!block.floors_from) errors.push(buildValidationError('MISSING_FIELD', `${title}: Не указана "Этажность (с)"`));
        if (!block.floors_to) errors.push(buildValidationError('MISSING_FIELD', `${title}: Не указана "Этажность (по)"`));

        const floorsToCheck = block.floors_to || 1;
        if (floorsToCheck > 5 && (!block.elevators_count || block.elevators_count < 1)) {
          errors.push(buildValidationError('ELEVATOR_REQUIRED', `${title}: Здание выше 5 этажей (${floorsToCheck} эт.) обязано иметь хотя бы 1 лифт`));
        }

        if (!eng || !Object.values(eng).some(v => v === true)) {
          errors.push(buildValidationError('ENGINEERING_REQUIRED', `${title}: Не выбрана ни одна инженерная коммуникация`));
        }
      });
    });
  }

  // 4. Шаг "Этажи"
  if (normalizedStepId === 'floors') {
    if (allBlocks.length === 0) {
      errors.push(buildValidationError('NO_BLOCKS', 'В проекте отсутствуют блоки'));
    } else {
      const blockIds = allBlocks.map(b => b.id);
      const { data: floors } = await supabase.from('floors').select('*').in('block_id', blockIds);
      const floorsByBlock = (floors || []).reduce((acc, f) => {
        if (!acc[f.block_id]) acc[f.block_id] = [];
        acc[f.block_id].push(f);
        return acc;
      }, {});

      allBlocks.forEach(block => {
        const blockFloors = floorsByBlock[block.id] || [];
        const title = `Блок "${block.label || 'Основной'}"`;

        if (blockFloors.length === 0) {
          errors.push(buildValidationError('NO_FLOORS', `${title}: Нет данных об этажах. Заполните матрицу высот и площадей.`));
          return;
        }

        blockFloors.forEach(f => {
          if (f.is_stylobate || f.floor_type === 'stylobate') return;

          const fLabel = f.label || `${f.index} этаж`;
          
          if (f.floor_type !== 'roof') {
            if (!f.height) {
              errors.push(buildValidationError('NO_HEIGHT', `${title}, ${fLabel}: Не указана высота.`));
            } else {
              const h = parseFloat(f.height);
              if (f.floor_type === 'basement' && (h < 1.8 || h > 4.0)) {
                errors.push(buildValidationError('BAD_HEIGHT', `${title}, ${fLabel}: Высота подвала должна быть 1.8-4.0 м.`));
              } else if (f.floor_type === 'technical' && (h < 1.5 || h > 6.0)) {
                errors.push(buildValidationError('BAD_HEIGHT', `${title}, ${fLabel}: Высота технического этажа должна быть 1.5-6.0 м.`));
              } else if (!['basement', 'technical'].includes(f.floor_type) && (h < 2.0 || h > 6.0)) {
                errors.push(buildValidationError('BAD_HEIGHT', `${title}, ${fLabel}: Высота должна быть 2.0-6.0 м.`));
              }
            }
          }

          if (!f.area_proj || parseFloat(f.area_proj) <= 0) {
            errors.push(buildValidationError('NO_AREA_PROJ', `${title}, ${fLabel}: Не указана проектная площадь.`));
          } else if (f.area_fact) {
            const proj = parseFloat(f.area_proj);
            const fact = parseFloat(f.area_fact);
            if ((Math.abs(proj - fact) / proj) * 100 > 15) {
              errors.push(buildValidationError('AREA_DIFF', `${title}, ${fLabel}: Критическое расхождение S Проект/Факт (>15%). Уточните замеры.`));
            }
          }
        });
      });
    }
  }

  // 5. Шаг "Квартиры" (проверка на дубликаты)
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
              errors.push(buildValidationError('DUPLICATE_UNIT', `В блоке (ID: ...${bId.slice(-4)}) обнаружен повторяющийся номер квартиры: "${num}".`));
            }
            unitsByBlock[bId][num] = true;
          }
        });
      } else {
        errors.push(buildValidationError('FLOORS_REQUIRED', 'Сначала заполните этажи для жилых блоков'));
      }
    }
  }

  if (normalizedStepId === 'entrances') {
    residentialBlocks.forEach(block => {
      if (!Number(block.entrances_count)) {
        errors.push(buildValidationError('ENTRANCES_REQUIRED', 'Для жилого блока отсутствуют подъезды', { blockId: block.id }));
      }
    });
  }

  return { ok: true, errors };
}

function parseCsvParam(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function normalizeProjectStatusFromDb(status) {
  if (status === 'project') return 'Проектный';
  if (status === 'construction') return 'Строящийся';
  if (status === 'completed') return 'Сдан в эксплуатацию';
  return status || 'Проектный';
}

function buildProjectAvailableActions(actorRole, projectDto, actorUserId) {
  const app = projectDto?.applicationInfo || {};
  const status = app.status;
  const substatus = app.workflowSubstatus;
  
  const isCompleted = status === 'COMPLETED';
  const isDeclined = status === 'DECLINED';
  const isPendingDecline = substatus === 'PENDING_DECLINE';

  const actions = ['view'];

  const isAdmin = actorRole === 'admin';
  const isBranchManager = actorRole === 'branch_manager';
  const isTechnician = actorRole === 'technician';
  const isController = actorRole === 'controller';
  
  // Возвращаем строгую проверку: задача либо не назначена, либо назначена на текущего юзера
  const isAssigned = !app.assigneeName || app.assigneeName === actorUserId; 

  if (!isCompleted && !isDeclined && (isAdmin || isBranchManager)) {
    actions.push('reassign');
  }

  if (isAdmin) actions.push('delete');

  if ((isAdmin || isBranchManager || isController) && !isCompleted) {
    actions.push('decline');
  }

  if (isPendingDecline && (isAdmin || isBranchManager)) {
    actions.push('return_from_decline');
  }

  const canTechnicianEdit = isTechnician && isAssigned && ['DRAFT', 'REVISION', 'RETURNED_BY_MANAGER', 'INTEGRATION'].includes(substatus);
  const canControllerEdit = isController && substatus === 'REVIEW';

  // ВАЖНО: Админ может заходить всегда, Техник/Контролер - только если прошли проверки выше
  if (!isCompleted && !isDeclined && (canTechnicianEdit || canControllerEdit || isAdmin)) {
    actions.push('edit');
  }

  return Array.from(new Set(actions));
}

export async function buildServer() {
  const config = getConfig();
  const supabase = createSupabaseAdminClient(config);
  const app = Fastify({ logger: true });
  const workflowIdempotencyStore = createIdempotencyStore();

  await app.register(cors, {
    origin: true, // Разрешаем запросы с любых адресов (для DEV-режима)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-user-id',
      'x-user-role',
      'x-idempotency-key',
      'x-client-request-id',
      'x-operation-source',
    ]
  });

  app.addHook('onRequest', async (req, reply) => {
    const operationSource = String(req.headers['x-operation-source'] || 'unknown');
    const clientRequestId = req.headers['x-client-request-id']
      ? String(req.headers['x-client-request-id'])
      : null;

    req.log.info({
      operationSource,
      clientRequestId,
      requestId: req.id,
      method: req.method,
      url: req.url,
    }, 'incoming request');

    reply.header('x-request-id', req.id);
    reply.header('x-operation-source', operationSource);
  });


  installAuthMiddleware(app, config);
  app.get('/health', async () => ({ ok: true }));

  registerAuthRoutes(app, { supabase, config });
  registerCompositionRoutes(app, { supabase });
  registerRegistryRoutes(app, { supabase });
  registerIntegrationRoutes(app, { supabase });
  registerProjectRoutes(app, { supabase });

  // =====================================================================
  // НОВЫЕ МАРШРУТЫ: Чтение справочников и списка проектов (Дашборд)
  // =====================================================================

  // 1. Чтение справочников (Catalogs)
  app.get('/api/v1/catalogs/:table', async (req, reply) => {
    const { table } = req.params;
    const { activeOnly } = req.query;

    if (!ALLOWED_CATALOG_TABLES.includes(table)) {
      return sendError(reply, 400, 'INVALID_TABLE', 'Таблица не разрешена');
    }

   let query = supabase
      .from(table)
      .select('*')
      .order('sort_order', { ascending: true });

    // Таблица пользователей сортируется по name, остальные по label
    if (table === 'dict_system_users') {
      query = query.order('name', { ascending: true });
    } else {
      query = query.order('label', { ascending: true });
    }

    if (activeOnly === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return data || [];
  });


  app.post('/api/v1/catalogs/:table/upsert', async (req, reply) => {
    if (!requirePolicyActor(req, reply, {
      module: 'catalogs',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate catalogs',
    })) return;

    const { table } = req.params;
    if (!ALLOWED_CATALOG_TABLES.includes(table)) {
      return sendError(reply, 400, 'INVALID_TABLE', 'Таблица не разрешена');
    }

    const item = req.body?.item || {};
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Body must include an item object');
    }

    const itemId = item.id == null ? null : String(item.id).trim();
    if (!itemId) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'item.id is required');
    }

    const payload = {
      ...item,
      id: itemId,
      code: item.code,
      label: item.label,
      sort_order: Number(item.sort_order || item.sortOrder || 100),
      is_active: item.is_active ?? item.isActive ?? true,
    };

    const { error } = await supabase.from(table).upsert(payload);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return { ok: true };
  });

  app.put('/api/v1/catalogs/:table/:id/active', async (req, reply) => {
    if (!requirePolicyActor(req, reply, {
      module: 'catalogs',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate catalogs',
    })) return;

    const { table, id } = req.params;
    if (!ALLOWED_CATALOG_TABLES.includes(table)) {
      return sendError(reply, 400, 'INVALID_TABLE', 'Таблица не разрешена');
    }

    if (typeof req.body?.isActive !== 'boolean') {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'isActive must be a boolean');
    }

    const isActive = req.body.isActive;
    const { error } = await supabase.from(table).update({ is_active: isActive }).eq('id', id);
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    return { ok: true };
  });
 // 3. Получение ID заявки по ID проекта (Вспомогательный роут)
  app.get('/api/v1/projects/:projectId/application-id', async (req, reply) => {
    const { projectId } = req.params;
    const { scope } = req.query;

    let query = supabase
      .from('applications')
      .select('id')
      .eq('project_id', projectId);

    if (scope) {
      query = query.eq('scope_id', scope);
    }

    const { data, error } = await query.maybeSingle();

    if (error) return reply.code(500).send({ code: 'DB_ERROR', message: error.message });
    if (!data) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Application not found' });

    return { applicationId: data.id };
  });
  app.post('/api/v1/projects/:projectId/validation/step', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'validation',
      action: 'mutate',
      forbiddenMessage: 'Role cannot validate project step',
    });
    if (!actor) return;

    const { projectId } = req.params;
    const scope = String(req.body?.scope || '').trim();
    const stepId = String(req.body?.stepId || '').trim();

    if (!scope) return sendError(reply, 400, 'VALIDATION_ERROR', 'scope is required');
    if (!stepId) return sendError(reply, 400, 'VALIDATION_ERROR', 'stepId is required');

    const { data: appRow, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('project_id', projectId)
      .eq('scope_id', scope)
      .maybeSingle();

    if (appError) return sendError(reply, 500, 'DB_ERROR', appError.message);
    if (!appRow?.id) return sendError(reply, 404, 'NOT_FOUND', 'Application not found');

    const validationRes = await buildStepValidationResult(supabase, { projectId, stepId });
    if (!validationRes.ok) {
      return sendError(reply, validationRes.status, validationRes.code, validationRes.message);
    }

    return reply.send({
      ok: validationRes.errors.length === 0,
      stepId,
      errors: validationRes.errors,
    });
  });

  app.get('/api/v1/external-applications', async (req, reply) => {
    const actor = req.authContext || null;
    if (!actor?.userId) return sendError(reply, 401, 'UNAUTHORIZED', 'Auth context required');

    const scope = String(req.query?.scope || '').trim();
    if (!scope) return sendError(reply, 400, 'MISSING_SCOPE', 'Scope is required');

    return reply.send([
      {
        id: 'EXT-10001',
        source: 'EPIGU',
        externalId: 'EP-2026-9912',
        applicant: 'ООО "Golden House"',
        submissionDate: new Date().toISOString(),
        cadastre: '10:10:10:10:10:0001',
        address: 'г. Ташкент, Шайхантахурский р-н, ул. Навои, 12',
        status: 'NEW',
        scope,
      },
    ]);
  });

  // 2. Чтение списка проектов для Дашборда (с серверной фильтрацией + пагинацией)
  app.get('/api/v1/projects', async (req, reply) => {
    const { scope } = req.query;
    if (!scope) return sendError(reply, 400, 'MISSING_SCOPE', 'Scope is required');

    const statusValues = parseCsvParam(req.query.status);
    const workflowSubstatusValues = parseCsvParam(req.query.workflowSubstatus);
    const assignee = req.query.assignee ? String(req.query.assignee) : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 1000)));

    const actor = req.authContext || null;

    let appsQuery = supabase
      .from('applications')
      .select('*')
      .eq('scope_id', scope)
      .order('updated_at', { ascending: false });

    if (statusValues.length === 1) appsQuery = appsQuery.eq('status', statusValues[0]);
    else if (statusValues.length > 1) appsQuery = appsQuery.in('status', statusValues);

    if (workflowSubstatusValues.length === 1) appsQuery = appsQuery.eq('workflow_substatus', workflowSubstatusValues[0]);
    else if (workflowSubstatusValues.length > 1) appsQuery = appsQuery.in('workflow_substatus', workflowSubstatusValues);
    if (assignee === 'mine') {
      if (!actor?.userId) return sendError(reply, 401, 'UNAUTHORIZED', 'Auth context required for assignee=mine');
      appsQuery = appsQuery.eq('assignee_name', actor.userId);
    } else if (assignee && assignee !== 'all') {
      appsQuery = appsQuery.eq('assignee_name', assignee);
    }

    const { data: appsData, error: appsError } = await appsQuery;
    if (appsError) return sendError(reply, 500, 'DB_ERROR', appsError.message);

    let filteredApps = appsData || [];

    if (search) {
      const lower = search.toLowerCase();
      filteredApps = filteredApps.filter(app =>
        String(app.internal_number || '').toLowerCase().includes(lower) ||
        String(app.external_id || '').toLowerCase().includes(lower) ||
        String(app.applicant || '').toLowerCase().includes(lower) ||
        String(app.assignee_name || '').toLowerCase().includes(lower)
      );
    }

    const projectIds = Array.from(new Set(filteredApps.map(app => app.project_id).filter(Boolean)));
    if (projectIds.length === 0) {
      return reply.send({ items: [], page, limit, total: 0, totalPages: 0 });
    }

    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('id, uj_code, cadastre_number, name, region, address, construction_status, updated_at, created_at, buildings(count)')
      .eq('scope_id', scope)
      .in('id', projectIds)
      .order('updated_at', { ascending: false });

    if (projectsError) return sendError(reply, 500, 'DB_ERROR', projectsError.message);

    const appsByProject = filteredApps.reduce((acc, app) => {
      if (!acc[app.project_id]) acc[app.project_id] = app;
      return acc;
    }, {});

    let mapped = (projectsData || []).map(project => {
      const app = appsByProject[project.id];
      const buildingsCount = project.buildings?.[0]?.count || 0;

      const dto = {
        id: project.id,
        ujCode: project.uj_code,
        cadastre: project.cadastre_number,
        applicationId: app?.id || null,
        name: project.name || 'Без названия',
        status: normalizeProjectStatusFromDb(project.construction_status),
        lastModified: app?.updated_at || project.updated_at,
        applicationInfo: {
          status: app?.status,
          workflowSubstatus: app?.workflow_substatus || 'DRAFT',
          internalNumber: app?.internal_number,
          externalSource: app?.external_source,
          externalId: app?.external_id,
          applicant: app?.applicant,
          submissionDate: app?.submission_date,
          assigneeName: app?.assignee_name,
          currentStage: app?.current_stage,
          currentStepIndex: app?.current_step,
          rejectionReason: app?.integration_data?.rejectionReason,
          requestedDeclineReason: app?.requested_decline_reason || null,
          requestedDeclineStep: app?.requested_decline_step ?? null,
          requestedDeclineBy: app?.requested_decline_by || null,
          requestedDeclineAt: app?.requested_decline_at || null,
        },
        complexInfo: {
          name: project.name,
          region: project.region,
          street: project.address,
        },
        composition: Array(buildingsCount).fill(1),
      };

      return {
        ...dto,
        availableActions: buildProjectAvailableActions(actor?.userRole, dto, actor?.userId),
      };
    });

    if (search) {
      const lower = search.toLowerCase();
      mapped = mapped.filter(p =>
        String(p.name || '').toLowerCase().includes(lower) ||
        String(p.ujCode || '').toLowerCase().includes(lower) ||
        String(p.applicationInfo?.internalNumber || '').toLowerCase().includes(lower) ||
        String(p.applicationInfo?.externalId || '').toLowerCase().includes(lower) ||
        String(p.complexInfo?.street || '').toLowerCase().includes(lower) ||
        String(p.applicationInfo?.assigneeName || '').toLowerCase().includes(lower)
      );
    }

    mapped.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    const total = mapped.length;
    const from = (page - 1) * limit;
    const to = from + limit;

    return reply.send({
      items: mapped.slice(from, to),
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    });
  });

  app.get('/api/v1/projects/summary-counts', async (req, reply) => {
    const { scope } = req.query;
    if (!scope) return sendError(reply, 400, 'MISSING_SCOPE', 'Scope is required');

    const actor = req.authContext || null;
    const assignee = req.query.assignee ? String(req.query.assignee) : null;

    let query = supabase
      .from('applications')
      .select('status, workflow_substatus, assignee_name')
      .eq('scope_id', scope);

    if (assignee === 'mine') {
      if (!actor?.userId) return sendError(reply, 401, 'UNAUTHORIZED', 'Auth context required for assignee=mine');
      query = query.eq('assignee_name', actor.userId);
    } else if (assignee && assignee !== 'all') {
      query = query.eq('assignee_name', assignee);
    }

    const { data, error } = await query;
    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);

    const rows = data || [];
    const workSubstatuses = new Set(['DRAFT', 'REVISION', 'RETURNED_BY_MANAGER']);

    const counts = {
      work: 0,
      review: 0,
      integration: 0,
      pendingDecline: 0,
      declined: 0,
      registryApplications: 0,
      registryComplexes: 0,
    };

    rows.forEach(row => {
      const status = row.status;
      const sub = row.workflow_substatus;

      if (status === 'IN_PROGRESS' && workSubstatuses.has(sub)) counts.work += 1;
      if (sub === 'REVIEW') counts.review += 1;
      if (sub === 'INTEGRATION') counts.integration += 1;
      if (sub === 'PENDING_DECLINE') counts.pendingDecline += 1;
      if (status === 'DECLINED') counts.declined += 1;
      if (status === 'COMPLETED' || status === 'DECLINED') counts.registryApplications += 1;
      if (status === 'COMPLETED') counts.registryComplexes += 1;
    });

    return reply.send(counts);
  });

  app.get('/api/v1/applications/:applicationId/locks', async (req, reply) => {
    const { applicationId } = req.params;
    const { data, error } = await supabase
      .from('application_locks')
      .select('owner_user_id, owner_role, expires_at')
      .eq('application_id', applicationId)
      .maybeSingle();

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    if (!data) return reply.send({ locked: false, ownerUserId: null, ownerRole: null, expiresAt: null });

    return reply.send({
      locked: true,
      ownerUserId: data.owner_user_id,
      ownerRole: data.owner_role,
      expiresAt: data.expires_at,
    });
  });

  app.post('/api/v1/applications/:applicationId/locks/acquire', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const ttlSeconds = Number(req.body?.ttlSeconds || 1200);

    const { data, error } = await supabase.rpc('acquire_application_lock', {
      p_application_id: applicationId,
      p_owner_user_id: actor.userId,
      p_owner_role: actor.userRole,
      p_ttl_seconds: Math.max(60, ttlSeconds),
    });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return sendError(reply, 500, 'EMPTY_RPC_RESPONSE', 'No response from lock RPC');

    const statusMap = { LOCKED: 409, ASSIGNEE_MISMATCH: 403, NOT_FOUND: 404 };
    if (!row.ok) return sendError(reply, statusMap[row.reason] || 409, row.reason || 'LOCK_ERROR', row.message);

    return reply.send({ ok: true, reason: row.reason, message: row.message, expiresAt: row.expires_at });
  });

  app.post('/api/v1/applications/:applicationId/locks/refresh', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const ttlSeconds = Number(req.body?.ttlSeconds || 1200);

    const { data, error } = await supabase.rpc('refresh_application_lock', {
      p_application_id: applicationId,
      p_owner_user_id: actor.userId,
      p_ttl_seconds: Math.max(60, ttlSeconds),
    });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return sendError(reply, 500, 'EMPTY_RPC_RESPONSE', 'No response from lock RPC');

    const statusMap = { OWNER_MISMATCH: 409, NOT_FOUND: 404 };
    if (!row.ok) return sendError(reply, statusMap[row.reason] || 409, row.reason || 'LOCK_ERROR', row.message);

    return reply.send({ ok: true, reason: row.reason, message: row.message, expiresAt: row.expires_at });
  });

  app.post('/api/v1/applications/:applicationId/locks/release', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;

    const { data, error } = await supabase.rpc('release_application_lock', {
      p_application_id: applicationId,
      p_owner_user_id: actor.userId,
    });

    if (error) return sendError(reply, 500, 'DB_ERROR', error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return sendError(reply, 500, 'EMPTY_RPC_RESPONSE', 'No response from lock RPC');

    const statusMap = { OWNER_MISMATCH: 409, NOT_FOUND: 404 };
    if (!row.ok) return sendError(reply, statusMap[row.reason] || 409, row.reason || 'LOCK_ERROR', row.message);

    return reply.send({ ok: true, reason: row.reason, message: row.message });
  });

  app.post('/api/v1/applications/:applicationId/workflow/complete-step', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const stepIndex = Number(req.body?.stepIndex);
    const comment = req.body?.comment || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

    if (!Number.isInteger(stepIndex) || stepIndex < 0) {
      return sendError(reply, 400, 'INVALID_STEP_INDEX', 'stepIndex must be a non-negative integer');
    }

    const lockCheck = await ensureActorLock(supabase, applicationId, actor.userId);
    if (!lockCheck.ok) return sendError(reply, lockCheck.status, lockCheck.code, lockCheck.message);

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);
    const { appRow } = appRes;

    if (Number(appRow.current_step) !== stepIndex) {
      return sendError(reply, 409, 'INVALID_STEP_STATE', 'stepIndex does not match current step', {
        expectedStepIndex: appRow.current_step,
        gotStepIndex: stepIndex,
      });
    }

    const transition = buildCompletionTransition(appRow);
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const completedRes = await updateStepCompletion(supabase, {
      applicationId,
      stepIndex,
      isCompleted: true,
    });
    if (!completedRes.ok) return sendError(reply, completedRes.status, completedRes.code, completedRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'COMPLETE_STEP',
      prevStatus: appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: comment || `Complete step ${stepIndex}`,
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/rollback-step', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

    const lockCheck = await ensureActorLock(supabase, applicationId, actor.userId);
    if (!lockCheck.ok) return sendError(reply, lockCheck.status, lockCheck.code, lockCheck.message);

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);
    const { appRow } = appRes;

    const transition = buildRollbackTransition(appRow);
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const rollbackCompletionRes = await updateStepCompletion(supabase, {
      applicationId,
      stepIndex: Number(appRow.current_step || 0),
      isCompleted: false,
    });
    if (!rollbackCompletionRes.ok) {
      return sendError(reply, rollbackCompletionRes.status, rollbackCompletionRes.code, rollbackCompletionRes.message);
    }

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'ROLLBACK_STEP',
      prevStatus: appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: reason || 'Rollback step',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/review-approve', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const transition = buildReviewTransition(appRes.appRow, 'APPROVE');
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const reviewedStage = Math.max(1, Number(appRes.appRow.current_stage || 1) - 1);
    const verifiedRes = await updateStageVerification(supabase, {
      applicationId,
      stage: reviewedStage,
      isVerified: true,
    });
    if (!verifiedRes.ok) return sendError(reply, verifiedRes.status, verifiedRes.code, verifiedRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'REVIEW_APPROVE',
      prevStatus: appRes.appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: comment || 'Review approved',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/review-reject', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'mutate',
      forbiddenMessage: 'Role cannot mutate workflow',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const transition = buildReviewTransition(appRes.appRow, 'REJECT');
    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const reviewedStage = Math.max(1, Number(appRes.appRow.current_stage || 1) - 1);
    const unverifyRes = await updateStageVerification(supabase, {
      applicationId,
      stage: reviewedStage,
      isVerified: false,
    });
    if (!unverifyRes.ok) return sendError(reply, unverifyRes.status, unverifyRes.code, unverifyRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'REVIEW_REJECT',
      prevStatus: appRes.appRow.status,
      nextStatus: transition.nextStatus,
      userName: actor.userId,
      comment: reason || 'Review rejected',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });


  app.post('/api/v1/applications/:applicationId/workflow/assign-technician', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'assignTechnician',
      forbiddenMessage: 'Only admin or branch_manager can assign technician',
    });
    if (!actor) return;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

        const { applicationId } = req.params;
    const assigneeUserId = req.body?.assigneeUserId;
    const reason = req.body?.reason || null;

    if (!assigneeUserId) return sendError(reply, 400, 'INVALID_PAYLOAD', 'assigneeUserId is required');

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const { error: assignError } = await supabase
      .from('applications')
      .update({ assignee_name: assigneeUserId, updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (assignError) return sendError(reply, 500, 'DB_ERROR', assignError.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'ASSIGN_TECHNICIAN',
      prevStatus: appRes.appRow.status,
      nextStatus: appRes.appRow.status,
      userName: actor.userId,
      comment: reason || `Assigned to ${assigneeUserId}`,
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = { assigneeUserId, workflowSubstatus: appRes.appRow.workflow_substatus, historyEventId: historyRes.historyEventId };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/request-decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'requestDecline',
      forbiddenMessage: 'Role cannot request decline',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;
    const stepIndex = Number(req.body?.stepIndex ?? 0);

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const { error: appErr } = await supabase
      .from('applications')
      .update({
        status: 'IN_PROGRESS',
        workflow_substatus: 'PENDING_DECLINE',
        requested_decline_reason: reason,
        requested_decline_step: Number.isInteger(stepIndex) ? stepIndex : appRes.appRow.current_step,
        requested_decline_by: actor.userId,
        requested_decline_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (appErr) return sendError(reply, 500, 'DB_ERROR', appErr.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'REQUEST_DECLINE',
      prevStatus: appRes.appRow.status,
      nextStatus: 'IN_PROGRESS',
      userName: actor.userId,
      comment: reason || 'Request decline',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      workflowSubstatus: 'PENDING_DECLINE',
      requestedDeclineAt: new Date().toISOString(),
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'decline',
      forbiddenMessage: 'Role cannot decline application',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const reason = req.body?.reason || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

    const substatusMap = {
      controller: 'DECLINED_BY_CONTROLLER',
      branch_manager: 'DECLINED_BY_MANAGER',
      admin: 'DECLINED_BY_ADMIN',
    };

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const transition = {
      nextStatus: 'DECLINED',
      nextSubstatus: substatusMap[actor.userRole] || 'DECLINED_BY_ADMIN',
      nextStepIndex: appRes.appRow.current_step,
      nextStage: appRes.appRow.current_stage,
    };

    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'DECLINE',
      prevStatus: appRes.appRow.status,
      nextStatus: 'DECLINED',
      userName: actor.userId,
      comment: reason || 'Declined',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/return-from-decline', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'returnFromDecline',
      forbiddenMessage: 'Only admin or branch_manager can return from decline',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const { error: appErr } = await supabase
      .from('applications')
      .update({
        status: 'IN_PROGRESS',
        workflow_substatus: 'RETURNED_BY_MANAGER',
        requested_decline_reason: null,
        requested_decline_step: null,
        requested_decline_by: null,
        requested_decline_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);
    if (appErr) return sendError(reply, 500, 'DB_ERROR', appErr.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'RETURN_FROM_DECLINE',
      prevStatus: appRes.appRow.status,
      nextStatus: 'IN_PROGRESS',
      userName: actor.userId,
      comment: comment || 'Return from decline',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = { workflowSubstatus: 'RETURNED_BY_MANAGER', historyEventId: historyRes.historyEventId };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  app.post('/api/v1/applications/:applicationId/workflow/restore', async (req, reply) => {
    const actor = requirePolicyActor(req, reply, {
      module: 'workflow',
      action: 'restore',
      forbiddenMessage: 'Only admin can restore application',
    });
    if (!actor) return;

    const { applicationId } = req.params;
    const comment = req.body?.comment || null;

    const idempotencyContext = buildIdempotencyContext(req, actor);
    if (tryServeIdempotentResponse(workflowIdempotencyStore, idempotencyContext, reply)) return;

    const appRes = await getApplication(supabase, applicationId);
    if (!appRes.ok) return sendError(reply, appRes.status, appRes.code, appRes.message);

    const transition = {
      nextStatus: 'IN_PROGRESS',
      nextSubstatus: 'DRAFT',
      nextStepIndex: appRes.appRow.current_step,
      nextStage: appRes.appRow.current_stage,
    };

    const updateRes = await updateApplicationState(supabase, applicationId, transition);
    if (!updateRes.ok) return sendError(reply, updateRes.status, updateRes.code, updateRes.message);

    const historyRes = await addHistory(supabase, {
      applicationId,
      action: 'RESTORE',
      prevStatus: appRes.appRow.status,
      nextStatus: 'IN_PROGRESS',
      userName: actor.userId,
      comment: comment || 'Restore application',
    });
    if (!historyRes.ok) return sendError(reply, historyRes.status, historyRes.code, historyRes.message);

    const response = {
      applicationStatus: updateRes.updatedApp.status,
      workflowSubstatus: updateRes.updatedApp.workflow_substatus,
      currentStep: updateRes.updatedApp.current_step,
      currentStage: updateRes.updatedApp.current_stage,
      historyEventId: historyRes.historyEventId,
    };
    rememberIdempotentResponse(workflowIdempotencyStore, idempotencyContext, response);
    return reply.send(response);
  });

  return { app, config };
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  const { app, config } = await buildServer();
  await app.listen({ port: config.port, host: config.host });
}
