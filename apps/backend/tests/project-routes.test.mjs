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

  order(column, options = {}) {
    this.state.order = { column, options };
    return this;
  }

  limit(value) {
    this.state.limit = value;
    return this;
  }

  insert(payload) {
    this.state.action = 'insert';
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
