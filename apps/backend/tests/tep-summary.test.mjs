import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerProjectExtendedRoutes } from '../src/project-extended-routes.js';

class MockQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.state = { filters: [], select: '*' };
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

  maybeSingle() {
    return this.#exec('maybeSingle');
  }

  single() {
    return this.#exec('single');
  }

  then(resolve, reject) {
    return this.#exec('many').then(resolve, reject);
  }

  async #exec(mode) {
    const result = await this.client.execute(this.table, this.state);
    if (result?.error) return result;

    const rows = result?.data ?? [];
    if (mode === 'single') return { data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null };
    if (mode === 'maybeSingle') return { data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null };
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
    const handler = this.handlers[table];
    if (!handler) return { data: [] };
    return handler(state);
  }
}

test('tep-summary endpoint returns aggregated metrics', async () => {
  const supabase = new MockSupabase({
    buildings: () => ({
      data: [{ id: 'b1', date_start: '2024-01-01', date_end: '2026-01-01' }],
    }),
    building_blocks: () => ({
      data: [{ id: 'bl1', building_id: 'b1' }],
    }),
    floors: () => ({
      data: [{ id: 'f1', area_proj: 1000, area_fact: 900 }],
    }),
    units: () => ({
      data: [
        { id: 'u1', unit_type: 'flat', total_area: 100, cadastre_number: '10:10:10:1' },
        { id: 'u2', unit_type: 'office', total_area: 200, cadastre_number: null },
      ],
    }),
  });

  const app = Fastify();
  registerProjectExtendedRoutes(app, { supabase });

  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/projects/p1/tep-summary',
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.totalAreaProj, 1000);
  assert.equal(body.totalAreaFact, 900);
  assert.equal(body.living.area, 100);
  assert.equal(body.commercial.area, 200);
  assert.equal(body.totalObjectsCount, 2);
  assert.equal(body.cadastreReadyCount, 1);
  assert.equal(body.mop.area, 700);

  await app.close();
});
