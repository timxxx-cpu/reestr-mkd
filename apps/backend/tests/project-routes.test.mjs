import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

class MockQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.state = {
      action: 'select',
      filters: [],
      payload: null,
      limit: null,
      order: null,
      select: '*',
    };
  }

  select(columns) {
    this.state.select = columns;
    return this;
  }

  eq(column, value) {
    this.state.filters.push({ type: 'eq', column, value });
    return this;
  }

  not(column, op, value) {
    this.state.filters.push({ type: 'not', column, op, value });
    return this;
  }

  in(column, values) {
    this.state.filters.push({ type: 'in', column, values });
    return this;
  }

  is(column, value) {
    this.state.filters.push({ type: 'is', column, value });
    return this;
  }

  order(column, options = {}) {
    this.state.order = { column, options };
    return this;
  }

  limit(value) {
    this.state.limit = value;
    return this;
  }

  range(from, to) {
    this.state.range = { from, to };
    return this;
  }

  insert(payload) {
    this.state.action = 'insert';
    this.state.payload = payload;
    return this;
  }

  upsert(payload) {
    this.state.action = 'upsert';
    this.state.payload = payload;
    return this;
  }

  update(payload) {
    this.state.action = 'update';
    this.state.payload = payload;
    return this;
  }

  delete() {
    this.state.action = 'delete';
    return this;
  }

  single() {
    return this.#exec('single');
  }

  maybeSingle() {
    return this.#exec('maybeSingle');
  }

  then(resolve, reject) {
    return this.#exec('many').then(resolve, reject);
  }

  async #exec(mode) {
    const result = await this.client.execute(this.table, this.state);
    if (result?.error) return result;

    const rows = result?.data ?? [];
    if (mode === 'single') {
      return { data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null };
    }

    if (mode === 'maybeSingle') {
      if (!Array.isArray(rows)) return { data: rows ?? null, error: null };
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows, error: null };
  }
}

class MockSupabase {
  constructor(handlers) {
    this.handlers = handlers;
  }

  from(table) {
    return new MockQuery(this, table);
  }

  async execute(table, state) {
    const handler = this.handlers[table]?.[state.action];
    if (!handler) return { data: [] };
    return handler(state);
  }

  async rpc(name, payload) {
    const handler = this.handlers.rpc?.[name];
    if (!handler) return { data: null, error: { message: `RPC ${name} is not implemented in mock` } };
    return handler(payload);
  }
}

const requestPayload = {
  scope: 'shared_dev_env',
  appData: {
    externalId: 'EXT-1',
    source: 'EPIGU',
    applicant: 'ООО Тест',
    cadastre: '10:09:03:02:01:1234',
  },
};

function createBasicSupabaseMock(track = { projectInserts: 0, appInserts: 0 }) {
  return new MockSupabase({
    projects: {
      select: state => {
        const isUjQuery = state.filters.some(f => f.column === 'scope_id') && state.select === 'uj_code';
        if (isUjQuery) return { data: [] };
        return { data: [{ id: 'project-1' }] };
      },
      insert: () => {
        track.projectInserts += 1;
        return { data: [{ id: 'project-1', uj_code: 'UJ000001', name: 'Проект' }] };
      },
      delete: () => ({ data: [] }),
    },
    applications: {
      select: () => ({ data: [] }),
      insert: () => {
        track.appInserts += 1;
        return { data: [{ id: 'app-1' }] };
      },
    },
  });
}

async function createAppWithRoutes(supabase) {
  const { registerProjectRoutes } = await import(`../src/project-routes.js?cache=${Date.now()}`);
  const app = Fastify();
  registerProjectRoutes(app, { supabase });
  return app;
}

test('project-init requires actor headers', async () => {
  process.env.VERSIONING_ENABLED = 'false';
  process.env.PROJECT_INIT_RPC_ENABLED = 'false';
  const app = await createAppWithRoutes(createBasicSupabaseMock());

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    payload: requestPayload,
  });

  assert.equal(res.statusCode, 401);
  await app.close();
});

test('project-init idempotency returns cached response for same key/payload', async () => {
  process.env.VERSIONING_ENABLED = 'false';
  process.env.PROJECT_INIT_RPC_ENABLED = 'false';
  const track = { projectInserts: 0, appInserts: 0 };
  const app = await createAppWithRoutes(createBasicSupabaseMock(track));

  const headers = {
    'x-user-id': encodeURIComponent('Техник 1'),
    'x-user-role': 'technician',
    'x-idempotency-key': 'project-init-key-1',
  };

  const first = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    headers,
    payload: requestPayload,
  });
  const second = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    headers,
    payload: requestPayload,
  });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());
  assert.equal(track.projectInserts, 1);
  assert.equal(track.appInserts, 1);
  await app.close();
});

test('project-init idempotency rejects key reuse with different payload', async () => {
  process.env.VERSIONING_ENABLED = 'false';
  process.env.PROJECT_INIT_RPC_ENABLED = 'false';
  const app = await createAppWithRoutes(createBasicSupabaseMock());

  const headers = {
    'x-user-id': encodeURIComponent('Техник 1'),
    'x-user-role': 'technician',
    'x-idempotency-key': 'project-init-key-2',
  };

  const first = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    headers,
    payload: requestPayload,
  });

  const second = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    headers,
    payload: { ...requestPayload, appData: { ...requestPayload.appData, externalId: 'EXT-CHANGED' } },
  });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 409);
  assert.equal(second.json().code, 'IDEMPOTENCY_CONFLICT');
  await app.close();
});

test('project-init returns warning when versioning is enabled but fails', async () => {
  process.env.VERSIONING_ENABLED = 'true';
  process.env.PROJECT_INIT_RPC_ENABLED = 'false';

  const supabase = new MockSupabase({
    projects: {
      select: state => {
        const isUjQuery = state.filters.some(f => f.column === 'scope_id') && state.select === 'uj_code';
        const isProjectById = state.filters.some(f => f.column === 'id');
        if (isUjQuery) return { data: [] };
        if (isProjectById) return { data: [{ id: 'project-1', name: 'Проект 1' }] };
        return { data: [] };
      },
      insert: () => ({ data: [{ id: 'project-1', uj_code: 'UJ000001', name: 'Проект 1' }] }),
      delete: () => ({ data: [] }),
    },
    applications: {
      select: () => ({ data: [] }),
      insert: () => ({ data: [{ id: 'app-1' }] }),
    },
    buildings: { select: () => ({ data: [] }) },
    object_versions: {
      select: () => ({ error: { message: 'object_versions read failed' } }),
    },
  });

  const app = await createAppWithRoutes(supabase);

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    headers: {
      'x-user-id': encodeURIComponent('Техник 1'),
      'x-user-role': 'technician',
    },
    payload: requestPayload,
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.versioning?.skipped, true);
  assert.match(body.warning || '', /object_versions read failed/);

  await app.close();
});


test('project-init uses RPC path when enabled and function succeeds', async () => {
  process.env.VERSIONING_ENABLED = 'false';
  process.env.PROJECT_INIT_RPC_ENABLED = 'true';

  const track = { projectInserts: 0, appInserts: 0, rpcCalls: 0 };
  const supabase = new MockSupabase({
    projects: {
      insert: () => {
        track.projectInserts += 1;
        return { data: [{ id: 'project-direct', uj_code: 'UJ999999' }] };
      },
    },
    applications: {
      insert: () => {
        track.appInserts += 1;
        return { data: [{ id: 'app-direct' }] };
      },
      select: () => ({ data: [] }),
    },
    rpc: {
      init_project_from_application: () => {
        track.rpcCalls += 1;
        return {
          data: [{
            ok: true,
            reason: 'OK',
            message: 'Project created',
            project_id: 'project-rpc-1',
            application_id: 'app-rpc-1',
            uj_code: 'UJ000123',
          }],
          error: null,
        };
      },
    },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    headers: {
      'x-user-id': encodeURIComponent('Техник RPC'),
      'x-user-role': 'technician',
    },
    payload: requestPayload,
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.projectId, 'project-rpc-1');
  assert.equal(body.applicationId, 'app-rpc-1');
  assert.equal(body.ujCode, 'UJ000123');
  assert.equal(track.rpcCalls, 1);
  assert.equal(track.projectInserts, 0);
  assert.equal(track.appInserts, 0);

  await app.close();
});

test('project-init falls back to direct path when RPC fails', async () => {
  process.env.VERSIONING_ENABLED = 'false';
  process.env.PROJECT_INIT_RPC_ENABLED = 'true';

  const track = { projectInserts: 0, appInserts: 0, rpcCalls: 0 };
  const supabase = new MockSupabase({
    projects: {
      select: state => {
        const isUjQuery = state.filters.some(f => f.column === 'scope_id') && state.select === 'uj_code';
        if (isUjQuery) return { data: [] };
        return { data: [{ id: 'project-direct-1' }] };
      },
      insert: () => {
        track.projectInserts += 1;
        return { data: [{ id: 'project-direct-1', uj_code: 'UJ000001', name: 'Проект direct' }] };
      },
      delete: () => ({ data: [] }),
    },
    applications: {
      select: () => ({ data: [] }),
      insert: () => {
        track.appInserts += 1;
        return { data: [{ id: 'app-direct-1' }] };
      },
    },
    rpc: {
      init_project_from_application: () => {
        track.rpcCalls += 1;
        return { data: null, error: { message: 'rpc missing function in env' } };
      },
    },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    headers: {
      'x-user-id': encodeURIComponent('Техник fallback'),
      'x-user-role': 'technician',
    },
    payload: requestPayload,
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.projectId, 'project-direct-1');
  assert.equal(body.applicationId, 'app-direct-1');
  assert.equal(track.rpcCalls, 1);
  assert.equal(track.projectInserts, 1);
  assert.equal(track.appInserts, 1);

  await app.close();
});

test('project-init returns REAPPLICATION_BLOCKED from RPC result', async () => {
  process.env.VERSIONING_ENABLED = 'false';
  process.env.PROJECT_INIT_RPC_ENABLED = 'true';

  const supabase = new MockSupabase({
    applications: { select: () => ({ data: [] }) },
    rpc: {
      init_project_from_application: () => ({
        data: [{ ok: false, reason: 'REAPPLICATION_BLOCKED', message: 'blocked by active app' }],
        error: null,
      }),
    },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/from-application',
    headers: {
      'x-user-id': encodeURIComponent('Техник blocked'),
      'x-user-role': 'technician',
    },
    payload: requestPayload,
  });

  assert.equal(res.statusCode, 409);
  assert.equal(res.json().code, 'REAPPLICATION_BLOCKED');

  await app.close();
});

test('project-passport get returns aggregated payload', async () => {
  const supabase = new MockSupabase({
    projects: {
      select: state => {
        if (state.filters.some(f => f.column === 'id')) {
          return { data: [{ id: 'project-1', name: 'Проект 1', uj_code: 'UJ000001', construction_status: 'Проектный' }] };
        }
        return { data: [] };
      },
    },
    project_participants: {
      select: () => ({ data: [{ id: 'p1', role: 'developer', name: 'ООО Дев', inn: '123' }] }),
    },
    project_documents: {
      select: () => ({ data: [{ id: 'd1', name: 'Док 1', doc_type: 'contract', doc_date: '2026-01-01', doc_number: '1', file_url: null }] }),
    },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({ method: 'GET', url: '/api/v1/projects/project-1/passport' });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.complexInfo.name, 'Проект 1');
  assert.equal(body.participants.developer.name, 'ООО Дев');
  assert.equal(body.documents.length, 1);
  await app.close();
});

test('basement level toggle requires actor headers', async () => {
  const app = await createAppWithRoutes(new MockSupabase({}));
  const res = await app.inject({
    method: 'PUT',
    url: '/api/v1/basements/b1/parking-levels/1',
    payload: { isEnabled: true },
  });

  assert.equal(res.statusCode, 401);
  await app.close();
});

test('versioning create returns inserted object version', async () => {
  const supabase = new MockSupabase({
    object_versions: {
      select: state => {
        if (state.select === 'version_number') return { data: [] };
        return { data: [] };
      },
      update: () => ({ data: [] }),
      insert: state => ({
        data: [{
          id: 'v1',
          entity_type: state.payload.entity_type,
          entity_id: state.payload.entity_id,
          version_number: state.payload.version_number,
          version_status: state.payload.version_status,
        }],
      }),
    },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/versions',
    headers: {
      'x-user-id': encodeURIComponent('Tester'),
      'x-user-role': 'technician',
    },
    payload: {
      entityType: 'unit',
      entityId: 'u1',
      snapshotData: { a: 1 },
    },
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.version_number, 1);
  assert.equal(body.version_status, 'PENDING');
  await app.close();
});

test('full-registry endpoint returns mapped aggregate payload', async () => {
  const supabase = new MockSupabase({
    buildings: {
      select: () => ({ data: [{ id: 'b1', project_id: 'p1', label: '1', house_number: '1', building_code: 'UJ000001-ZD01' }] }),
    },
    building_blocks: {
      select: () => ({ data: [{ id: 'bl1', building_id: 'b1', label: '1A' }] }),
    },
    floors: {
      select: () => ({ data: [{ id: 'f1', block_id: 'bl1', area_proj: 100, area_fact: 99 }] }),
    },
    entrances: {
      select: () => ({ data: [{ id: 'e1', block_id: 'bl1', number: 1 }] }),
    },
    units: {
      select: () => ({
        data: [{
          id: 'u1',
          floor_id: 'f1',
          entrance_id: 'e1',
          unit_code: 'UJ000001-ZD01-EL001',
          number: '1',
          unit_type: 'apartment',
          total_area: 45,
          living_area: 20,
          useful_area: 30,
          rooms_count: 2,
          has_mezzanine: false,
          mezzanine_type: null,
          cadastre_number: null,
          rooms: [],
        }],
      }),
    },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({ method: 'GET', url: '/api/v1/projects/p1/full-registry' });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.buildings.length, 1);
  assert.equal(body.blocks.length, 1);
  assert.equal(body.floors.length, 1);
  assert.equal(body.units.length, 1);
  assert.equal(body.units[0].buildingCode, 'UJ000001-ZD01');
  await app.close();
});

test('project context endpoint returns aggregate source payload', async () => {
  const supabase = new MockSupabase({
    applications: {
      select: () => ({ data: [{ id: 'app-ctx-1', project_id: 'project-1', scope_id: 'shared_dev_env' }] }),
    },
    projects: {
      select: state => {
        if (state.filters.some(f => f.column === 'id')) {
          return { data: [{ id: 'project-1', name: 'Проект 1' }] };
        }
        return { data: [] };
      },
    },
    project_participants: {
      select: () => ({ data: [{ id: 'pp1', role: 'developer', name: 'DEV Co', inn: '123' }] }),
    },
    project_documents: {
      select: () => ({ data: [{ id: 'doc1', name: 'Doc', doc_type: 'contract' }] }),
    },
    buildings: {
      select: () => ({ data: [{ id: 'b1', project_id: 'project-1', building_blocks: [] }] }),
    },
    application_history: {
      select: () => ({ data: [{ id: 'h1', application_id: 'app-ctx-1', action: 'CREATE' }] }),
    },
    application_steps: {
      select: () => ({ data: [{ id: 's1', application_id: 'app-ctx-1', step_index: 0, is_completed: false }] }),
    },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/projects/project-1/context?scope=shared_dev_env',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.project.id, 'project-1');
  assert.equal(body.application.id, 'app-ctx-1');
  assert.equal(body.participants.length, 1);
  assert.equal(body.documents.length, 1);
  assert.equal(body.buildings.length, 1);
  assert.equal(body.history.length, 1);
  assert.equal(body.steps.length, 1);
  await app.close();
});

test('project context registry details endpoint returns detailed read payload', async () => {
  const supabase = new MockSupabase({
    buildings: {
      select: () => ({ data: [{ id: 'b1', building_blocks: [{ id: 'bl1' }] }] }),
    },
    block_floor_markers: {
      select: () => ({ data: [{ block_id: 'bl1', marker_key: '1', is_technical: false, is_commercial: true }] }),
    },
    floors: {
      select: () => ({ data: [{ id: 'f1', block_id: 'bl1', index: 1, floor_key: 'floor:1' }] }),
    },
    entrances: {
      select: () => ({ data: [{ id: 'e1', block_id: 'bl1', number: 1 }] }),
    },
    entrance_matrix: {
      select: () => ({ data: [{ floor_id: 'f1', entrance_number: 1, flats_count: 1, commercial_count: 0, mop_count: 0 }] }),
    },
    units: {
      select: () => ({ data: [{ id: 'u1', floor_id: 'f1', entrance_id: 'e1', unit_type: 'apartment', number: '1', rooms: [] }] }),
    },
    common_areas: {
      select: () => ({ data: [{ id: 'm1', floor_id: 'f1', entrance_id: 'e1', type: 'corridor' }] }),
    },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/projects/project-1/context-registry-details',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.markerRows.length, 1);
  assert.equal(body.floors.length, 1);
  assert.equal(body.entrances.length, 1);
  assert.equal(body.matrix.length, 1);
  assert.equal(body.units.length, 1);
  assert.equal(body.mops.length, 1);
  await app.close();
});

test('project context meta save endpoint saves project/application meta', async () => {
  const track = { projectUpdated: 0, appUpdated: 0 };
  const supabase = new MockSupabase({
    projects: {
      update: () => {
        track.projectUpdated += 1;
        return { data: [] };
      },
      select: () => ({ data: [{ id: 'project-1' }] }),
    },
    applications: {
      select: () => ({ data: [{ id: 'app-1' }] }),
      update: () => {
        track.appUpdated += 1;
        return { data: [] };
      },
      insert: () => ({ data: [{ id: 'app-1' }] }),
    },
    application_history: { insert: () => ({ data: [] }) },
    application_steps: { upsert: () => ({ data: [] }) },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/project-1/context-meta/save',
    headers: {
      'x-user-id': encodeURIComponent('Tester'),
      'x-user-role': 'technician',
    },
    payload: {
      scope: 'shared_dev_env',
      complexInfo: { name: 'Project 1', status: 'Проектный', street: 'Street 1' },
      applicationInfo: { status: 'IN_PROGRESS', currentStepIndex: 1, currentStage: 1 },
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(track.projectUpdated, 1);
  assert.equal(track.appUpdated, 1);
  assert.equal(res.json().projectId, 'project-1');
  assert.equal(res.json().applicationId, 'app-1');
  await app.close();
});

test('project context building-details save endpoint processes block updates', async () => {
  const track = {
    blockUpdated: 0,
    markersReplaced: 0,
    floorsSelect: 0,
    entrancesSelect: 0,
    matrixSelect: 0,
    matrixDelete: 0,
  };
  const supabase = new MockSupabase({
    buildings: {
      select: () => ({ data: [{ id: 'b1' }] }),
    },
    floors: {
      select: () => {
        track.floorsSelect += 1;
        return { data: [] };
      },
      insert: () => ({ data: [] }),
      delete: () => ({ data: [] }),
    },
    entrances: {
      select: () => {
        track.entrancesSelect += 1;
        return { data: [] };
      },
      insert: () => ({ data: [] }),
      delete: () => ({ data: [] }),
    },
    entrance_matrix: {
      select: () => {
        track.matrixSelect += 1;
        return { data: [] };
      },
      upsert: () => ({ data: [] }),
      delete: () => {
        track.matrixDelete += 1;
        return { data: [] };
      },
    },
    building_blocks: {
      update: () => {
        track.blockUpdated += 1;
        return { data: [] };
      },
    },
    block_floor_markers: {
      delete: () => ({ data: [] }),
      upsert: () => {
        track.markersReplaced += 1;
        return { data: [] };
      },
    },
    block_construction: { upsert: () => ({ data: [] }) },
    block_engineering: { upsert: () => ({ data: [] }) },
    basements: { upsert: () => ({ data: [] }) },
    basement_parking_levels: { upsert: () => ({ data: [] }) },
  });

  const app = await createAppWithRoutes(supabase);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects/project-1/context-building-details/save',
    headers: {
      'x-user-id': encodeURIComponent('Tester'),
      'x-user-role': 'technician',
    },
    payload: {
      buildingDetails: {
        'b1_11111111-1111-1111-1111-111111111111': {
          floorsCount: 10,
          entrances: 2,
          technicalFloors: [1],
          commercialFloors: ['1'],
          engineering: { electricity: true },
        },
      },
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(track.blockUpdated, 1);
  assert.equal(track.markersReplaced, 1);
  assert.equal(track.floorsSelect > 0, true);
  assert.equal(track.entrancesSelect > 0, true);
  assert.equal(track.matrixSelect > 0 || track.matrixDelete > 0, true);
  await app.close();
});
