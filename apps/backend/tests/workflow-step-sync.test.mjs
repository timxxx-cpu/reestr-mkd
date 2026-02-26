import test from 'node:test';
import assert from 'node:assert/strict';
import { getStageStepRange } from '../src/workflow-transitions.js';
import { updateStepCompletion, updateStageVerification } from '../src/application-repository.js';

class MockSupabaseForUpsert {
  constructor() {
    this.calls = [];
  }

  from(table) {
    return {
      upsert: async (payload, options) => {
        this.calls.push({ table, payload, options });
        return { error: null };
      },
    };
  }
}

test('getStageStepRange returns correct boundaries for every workflow stage', () => {
  assert.deepEqual(getStageStepRange(1), { start: 0, end: 6 });
  assert.deepEqual(getStageStepRange(2), { start: 7, end: 9 });
  assert.deepEqual(getStageStepRange(3), { start: 10, end: 12 });
  assert.deepEqual(getStageStepRange(4), { start: 13, end: 14 });
});

test('updateStepCompletion upserts completion flag for a single step', async () => {
  const supabase = new MockSupabaseForUpsert();

  const res = await updateStepCompletion(supabase, {
    applicationId: 'app-1',
    stepIndex: 4,
    isCompleted: true,
  });

  assert.equal(res.ok, true);
  assert.equal(supabase.calls.length, 1);
  assert.deepEqual(supabase.calls[0], {
    table: 'application_steps',
    payload: {
      application_id: 'app-1',
      step_index: 4,
      is_completed: true,
    },
    options: { onConflict: 'application_id,step_index' },
  });
});

test('updateStageVerification approves a whole stage range', async () => {
  const supabase = new MockSupabaseForUpsert();

  const res = await updateStageVerification(supabase, {
    applicationId: 'app-2',
    stage: 3,
    isVerified: true,
  });

  assert.equal(res.ok, true);
  assert.equal(supabase.calls.length, 1);
  assert.equal(supabase.calls[0].table, 'application_steps');
  assert.equal(supabase.calls[0].options.onConflict, 'application_id,step_index');

  const payload = supabase.calls[0].payload;
  assert.equal(payload.length, 3);
  assert.deepEqual(payload.map(p => p.step_index), [10, 11, 12]);
  assert.equal(payload.every(p => p.is_verified === true), true);
});

test('updateStageVerification rejects invalid stage', async () => {
  const supabase = new MockSupabaseForUpsert();

  const res = await updateStageVerification(supabase, {
    applicationId: 'app-3',
    stage: 99,
    isVerified: false,
  });

  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID_STAGE');
  assert.equal(supabase.calls.length, 0);
});
