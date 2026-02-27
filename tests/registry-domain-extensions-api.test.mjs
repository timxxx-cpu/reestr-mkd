import test from 'node:test';
import assert from 'node:assert/strict';

import { createRegistryDomainApi } from '../src/lib/api/registry-domain.js';

const createHarness = () => {
  const calls = [];
  const requireCalls = [];

  const BffClient = {
    getBlockExtensions: async payload => {
      calls.push({ op: 'getBlockExtensions', payload });
      return [{ id: 'ext-1' }];
    },
    createBlockExtension: async payload => {
      calls.push({ op: 'createBlockExtension', payload });
      return { id: 'ext-created' };
    },
    updateBlockExtension: async payload => {
      calls.push({ op: 'updateBlockExtension', payload });
      return { id: payload.extensionId };
    },
    deleteBlockExtension: async payload => {
      calls.push({ op: 'deleteBlockExtension', payload });
      return { ok: true };
    },
  };

  const api = createRegistryDomainApi({
    BffClient,
    requireBffEnabled: op => requireCalls.push(op),
    resolveActor: actor => ({
      userName: actor.userName || 'actor-name',
      userRole: actor.userRole || 'actor-role',
    }),
    createIdempotencyKey: (op, scopeParts) => `idem:${op}:${scopeParts.join(':')}`,
    mapFloorFromDB: v => v,
    mapUnitFromDB: v => v,
    mapMopFromDB: v => v,
  });

  return { api, calls, requireCalls };
};

test('getBlockExtensions enforces BFF gate and forwards blockId', async () => {
  const { api, calls, requireCalls } = createHarness();

  const result = await api.getBlockExtensions('block-1');

  assert.deepEqual(result, [{ id: 'ext-1' }]);
  assert.deepEqual(requireCalls, ['extensions.getBlockExtensions']);
  assert.deepEqual(calls, [{ op: 'getBlockExtensions', payload: { blockId: 'block-1' } }]);
});

test('create/update/delete block extension pass actor and idempotency keys', async () => {
  const { api, calls, requireCalls } = createHarness();

  await api.createBlockExtension('block-2', { label: 'Ext A' }, { userName: 'u1', userRole: 'r1' });
  await api.updateBlockExtension('ext-2', { label: 'Ext B' }, { userName: 'u2', userRole: 'r2' });
  await api.deleteBlockExtension('ext-3', { userName: 'u3', userRole: 'r3' });

  assert.deepEqual(requireCalls, [
    'extensions.createBlockExtension',
    'extensions.updateBlockExtension',
    'extensions.deleteBlockExtension',
  ]);

  assert.deepEqual(calls, [
    {
      op: 'createBlockExtension',
      payload: {
        blockId: 'block-2',
        extensionData: { label: 'Ext A' },
        userName: 'u1',
        userRole: 'r1',
        idempotencyKey: 'idem:extensions-create:block-2',
      },
    },
    {
      op: 'updateBlockExtension',
      payload: {
        extensionId: 'ext-2',
        extensionData: { label: 'Ext B' },
        userName: 'u2',
        userRole: 'r2',
        idempotencyKey: 'idem:extensions-update:ext-2',
      },
    },
    {
      op: 'deleteBlockExtension',
      payload: {
        extensionId: 'ext-3',
        userName: 'u3',
        userRole: 'r3',
        idempotencyKey: 'idem:extensions-delete:ext-3',
      },
    },
  ]);
});
