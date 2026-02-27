import test from 'node:test';
import assert from 'node:assert/strict';

import { createProjectDomainApi } from '../src/lib/api/project-domain.js';

const createApi = ({ context, captured }) =>
  createProjectDomainApi({
    BffClient: {
      getProjectContext: async () => context,
    },
    requireBffEnabled: () => {},
    resolveActor: actor => actor,
    createIdempotencyKey: () => 'fixed-key',
    mapProjectAggregate: () => ({ projectId: 'p-1' }),
    mapBuildingFromDB: (building, enrichedBlocks) => {
      captured.blocks = enrichedBlocks;
      return {
        id: building.id,
        blocks: enrichedBlocks,
      };
    },
    mapBlockDetailsFromDB: () => ({}),
  });

test('getProjectFullData merges nested and top-level block_extensions with dedupe by id', async () => {
  const captured = { blocks: [] };
  const context = {
    application: { id: 'a-1' },
    project: { id: 'p-1', updated_at: '2025-01-01T00:00:00Z' },
    participants: [],
    documents: [],
    history: [],
    steps: [],
    block_floor_markers: [],
    block_extensions: [
      { id: 'ext-2', parent_block_id: 'block-1', label: 'from-top-level-2' },
      { id: 'ext-3', parent_block_id: 'block-1', label: 'from-top-level-3' },
      { id: null, parent_block_id: 'block-1', label: 'invalid-no-id' },
    ],
    buildings: [
      {
        id: 'building-1',
        building_blocks: [
          {
            id: 'block-1',
            building_id: 'building-1',
            is_basement_block: false,
            block_extensions: [
              { id: 'ext-1', parent_block_id: 'block-1', label: 'from-nested-1' },
              { id: 'ext-2', parent_block_id: 'block-1', label: 'from-nested-2' },
            ],
          },
        ],
      },
    ],
  };

  const api = createApi({ context, captured });
  const result = await api.getProjectFullData('shared_dev_env', 'project-1');

  assert.ok(result);
  assert.equal(Array.isArray(captured.blocks), true);
  assert.equal(captured.blocks.length, 1);

  const mergedExtensions = captured.blocks[0].block_extensions;
  assert.equal(Array.isArray(mergedExtensions), true);
  assert.deepEqual(
    mergedExtensions.map(item => item.id),
    ['ext-1', 'ext-2', 'ext-3'],
    'extensions must be merged from both sources and deduped by id'
  );
});


test('getProjectFullData ignores top-level extensions without matching parent block', async () => {
  const captured = { blocks: [] };
  const context = {
    application: { id: 'a-2' },
    project: { id: 'p-2', updated_at: '2025-01-01T00:00:00Z' },
    participants: [],
    documents: [],
    history: [],
    steps: [],
    block_floor_markers: [],
    block_extensions: [
      { id: 'ext-orphan', parent_block_id: 'missing-block', label: 'orphan' },
      { id: 'ext-known', parent_block_id: 'block-9', label: 'known' },
    ],
    buildings: [
      {
        id: 'building-9',
        building_blocks: [
          {
            id: 'block-9',
            building_id: 'building-9',
            is_basement_block: false,
            block_extensions: [],
          },
        ],
      },
    ],
  };

  const api = createApi({ context, captured });
  await api.getProjectFullData('shared_dev_env', 'project-9');

  assert.equal(captured.blocks.length, 1);
  const mergedExtensions = captured.blocks[0].block_extensions;
  assert.deepEqual(
    mergedExtensions.map(item => item.id),
    ['ext-known'],
    'orphan top-level extensions should not leak into unrelated blocks'
  );
});


test('getProjectFullData keeps nested block extension payload when duplicate id exists top-level', async () => {
  const captured = { blocks: [] };
  const context = {
    application: { id: 'a-3' },
    project: { id: 'p-3', updated_at: '2025-01-01T00:00:00Z' },
    participants: [],
    documents: [],
    history: [],
    steps: [],
    block_floor_markers: [],
    block_extensions: [
      {
        id: 'ext-shared',
        parent_block_id: 'block-3',
        label: 'top-level-version',
        extension_type: 'PASSAGE',
      },
    ],
    buildings: [
      {
        id: 'building-3',
        building_blocks: [
          {
            id: 'block-3',
            building_id: 'building-3',
            is_basement_block: false,
            block_extensions: [
              {
                id: 'ext-shared',
                parent_block_id: 'block-3',
                label: 'nested-version',
                extension_type: 'VESTIBULE',
              },
            ],
          },
        ],
      },
    ],
  };

  const api = createApi({ context, captured });
  await api.getProjectFullData('shared_dev_env', 'project-3');

  assert.equal(captured.blocks.length, 1);
  const mergedExtensions = captured.blocks[0].block_extensions;
  assert.equal(mergedExtensions.length, 1);
  assert.equal(mergedExtensions[0].id, 'ext-shared');
  assert.equal(mergedExtensions[0].label, 'nested-version');
  assert.equal(
    mergedExtensions[0].extension_type,
    'VESTIBULE',
    'nested payload should win for duplicate extension id to keep block-scoped source authoritative'
  );
});


test('getProjectFullData distributes top-level extensions to matching parent blocks only', async () => {
  const captured = { blocks: [] };
  const context = {
    application: { id: 'a-4' },
    project: { id: 'p-4', updated_at: '2025-01-01T00:00:00Z' },
    participants: [],
    documents: [],
    history: [],
    steps: [],
    block_floor_markers: [],
    block_extensions: [
      { id: 'ext-a1', parent_block_id: 'block-a', label: 'A1' },
      { id: 'ext-b1', parent_block_id: 'block-b', label: 'B1' },
      { id: 'ext-b2', parent_block_id: 'block-b', label: 'B2' },
    ],
    buildings: [
      {
        id: 'building-4',
        building_blocks: [
          {
            id: 'block-a',
            building_id: 'building-4',
            is_basement_block: false,
            block_extensions: [{ id: 'ext-a0', parent_block_id: 'block-a', label: 'A0' }],
          },
          {
            id: 'block-b',
            building_id: 'building-4',
            is_basement_block: false,
            block_extensions: [],
          },
        ],
      },
    ],
  };

  const api = createApi({ context, captured });
  await api.getProjectFullData('shared_dev_env', 'project-4');

  assert.equal(captured.blocks.length, 2);
  const blockA = captured.blocks.find(item => item.id === 'block-a');
  const blockB = captured.blocks.find(item => item.id === 'block-b');

  assert.deepEqual(
    (blockA?.block_extensions || []).map(item => item.id),
    ['ext-a0', 'ext-a1'],
    'block A should receive only its own top-level extensions'
  );

  assert.deepEqual(
    (blockB?.block_extensions || []).map(item => item.id),
    ['ext-b1', 'ext-b2'],
    'block B should receive only its own top-level extensions'
  );
});
