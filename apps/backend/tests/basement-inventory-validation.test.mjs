import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStepValidationResult } from '../src/validation.js';

class SupabaseMock {
  constructor(buildings) {
    this.buildings = buildings;
  }

  from(table) {
    if (table !== 'buildings') throw new Error(`Unexpected table ${table}`);
    return {
      select: () => ({
        eq: async () => ({ data: this.buildings, error: null }),
      }),
    };
  }
}

test('basement_inventory validates depth/communications/links/parking levels', async () => {
  const buildings = [
    {
      id: 'b1',
      label: 'ЖК Тест',
      building_code: 'UJ-ZM01',
      house_number: '1',
      category: 'residential_multiblock',
      building_blocks: [
        { id: 'r1', label: 'Секция 1', is_basement_block: false },
        { id: 'r2', label: 'Секция 2', is_basement_block: false },
        {
          id: 'bs1',
          label: 'Подвал 1',
          is_basement_block: true,
          basement_depth: 5,
          linked_block_ids: [],
          basement_communications: { electricity: true },
          basement_parking_levels: { '6': true, '1': 'yes' },
        },
      ],
    },
  ];

  const res = await buildStepValidationResult(new SupabaseMock(buildings), {
    projectId: 'p1',
    stepId: 'basement_inventory',
  });

  assert.equal(res.ok, true);
  const codes = new Set(res.errors.map(e => e.code));
  assert.equal(codes.has('BASEMENT_DEPTH_INVALID'), true);
  assert.equal(codes.has('BASEMENT_COMM_REQUIRED'), true);
  assert.equal(codes.has('BASEMENT_LINKS_REQUIRED'), true);
  assert.equal(codes.has('BASEMENT_PARKING_LEVEL_INVALID'), true);
  assert.equal(codes.has('BASEMENT_PARKING_LEVEL_FLAG_INVALID'), true);
});
