import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { installAuthMiddleware } from '../src/auth.js';
import { registerRegistryRoutes } from '../src/registry-routes.js';

class MockQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.state = {
      action: 'select',
      filters: [],
      payload: null,
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

  in(column, values) {
    this.state.filters.push({ type: 'in', column, values });
    return this;
  }

  order(column, options = {}) {
    this.state.order = { column, options };
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
    if (mode === 'single') return { data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null };
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
    if (!handler) return { data: [], error: null };
    return handler(state);
  }
}

const actorHeaders = {
  'x-user-id': encodeURIComponent('Техник 1'),
  'x-user-role': 'technician',
};

const createApp = async supabase => {
  const app = Fastify();
  installAuthMiddleware(app, { authMode: 'dev' });
  registerRegistryRoutes(app, { supabase });
  return app;
};

test('extensions GET returns rows ordered by created_at', async () => {
  const supabase = new MockSupabase({
    block_extensions: {
      select: state => {
        assert.deepEqual(state.filters, [{ type: 'eq', column: 'parent_block_id', value: 'block-1' }]);
        assert.deepEqual(state.order, { column: 'created_at', options: { ascending: true } });
        return {
          data: [
            { id: 'ext-1', parent_block_id: 'block-1', label: 'A' },
            { id: 'ext-2', parent_block_id: 'block-1', label: 'B' },
          ],
          error: null,
        };
      },
    },
  });

  const app = await createApp(supabase);
  const res = await app.inject({ method: 'GET', url: '/api/v1/blocks/block-1/extensions' });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), [
    { id: 'ext-1', parent_block_id: 'block-1', label: 'A' },
    { id: 'ext-2', parent_block_id: 'block-1', label: 'B' },
  ]);

  await app.close();
});

test('extensions POST validates payload and returns validation error', async () => {
  const supabase = new MockSupabase({
    building_blocks: {
      select: () => ({ data: [{ id: 'block-1', building_id: 'building-1' }], error: null }),
    },
  });

  const app = await createApp(supabase);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/blocks/block-1/extensions',
    headers: actorHeaders,
    payload: {
      extensionData: {
        label: '',
        floorsCount: 0,
      },
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().code, 'VALIDATION_ERROR');

  await app.close();
});

test('extensions POST supports idempotency and persists normalized payload', async () => {
  const calls = { inserts: 0 };
  const supabase = new MockSupabase({
    building_blocks: {
      select: state => {
        assert.deepEqual(state.filters, [{ type: 'eq', column: 'id', value: 'block-2' }]);
        return { data: [{ id: 'block-2', building_id: 'building-2' }], error: null };
      },
    },
    block_extensions: {
      insert: state => {
        calls.inserts += 1;
        assert.equal(state.payload.parent_block_id, 'block-2');
        assert.equal(state.payload.building_id, 'building-2');
        assert.equal(state.payload.extension_type, 'CANOPY');
        assert.equal(state.payload.construction_kind, 'light');
        assert.equal(state.payload.vertical_anchor_type, 'BLOCK_FLOOR');
        assert.equal(state.payload.anchor_floor_key, 'F2');
        return { data: [{ id: 'ext-created', ...state.payload }], error: null };
      },
    },
  });

  const app = await createApp(supabase);
  const request = {
    method: 'POST',
    url: '/api/v1/blocks/block-2/extensions',
    headers: { ...actorHeaders, 'x-idempotency-key': 'ext-create-1' },
    payload: {
      extensionData: {
        label: '  Галерея  ',
        extensionType: 'canopy',
        constructionKind: 'LIGHT',
        floorsCount: 2,
        startFloorIndex: 2,
        verticalAnchorType: 'block_floor',
        anchorFloorKey: 'F2',
      },
    },
  };

  const first = await app.inject(request);
  const second = await app.inject(request);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.json(), first.json());
  assert.equal(calls.inserts, 1);

  await app.close();
});

test('extensions PUT and DELETE return 404 for unknown extension', async () => {
  const supabase = new MockSupabase({
    block_extensions: {
      update: () => ({ data: [], error: null }),
      delete: () => ({ data: [], error: null }),
    },
  });

  const app = await createApp(supabase);

  const updateRes = await app.inject({
    method: 'PUT',
    url: '/api/v1/extensions/ext-missing',
    headers: { ...actorHeaders, 'x-idempotency-key': 'ext-update-missing' },
    payload: {
      extensionData: {
        label: 'X',
        extensionType: 'OTHER',
        constructionKind: 'capital',
        floorsCount: 1,
        startFloorIndex: 1,
        verticalAnchorType: 'GROUND',
      },
    },
  });

  const deleteRes = await app.inject({
    method: 'DELETE',
    url: '/api/v1/extensions/ext-missing',
    headers: { ...actorHeaders, 'x-idempotency-key': 'ext-delete-missing' },
  });

  assert.equal(updateRes.statusCode, 404);
  assert.equal(deleteRes.statusCode, 404);

  await app.close();
});
