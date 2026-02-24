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
      order: null,
      select: '*',
    };
  }

  select(columns) {
    this.state.select = columns;
    return this;
  }

  order(column, options = {}) {
    this.state.order = { column, options };
    return this;
  }

  then(resolve, reject) {
    return this.client.execute(this.table, this.state).then(resolve, reject);
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

test('registry buildings summary endpoint returns ordered summary rows', async () => {
  const supabase = new MockSupabase({
    view_registry_buildings_summary: {
      select: state => {
        assert.equal(state.select, '*');
        assert.deepEqual(state.order, { column: 'project_name', options: { ascending: true } });
        return {
          data: [
            { building_id: 'b1', project_name: 'ЖК Альфа' },
            { building_id: 'b2', project_name: 'ЖК Бета' },
          ],
          error: null,
        };
      },
    },
  });

  const { registerRegistryRoutes } = await import(`../src/registry-routes.js?cache=${Date.now()}`);
  const app = Fastify();
  registerRegistryRoutes(app, { supabase });

  const res = await app.inject({ method: 'GET', url: '/api/v1/registry/buildings-summary' });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), [
    { building_id: 'b1', project_name: 'ЖК Альфа' },
    { building_id: 'b2', project_name: 'ЖК Бета' },
  ]);

  await app.close();
});
