import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const buildServerImport = async () => {
  const mod = await import(`../src/server.js?route-sync=${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return mod.buildServer;
};

async function createFakeSupabaseServer({ appRow, lockRow, failStepUpsert = false }) {
  const state = {
    appRow: { ...appRow },
    appPatchCalls: [],
    stepUpserts: [],
    historyInserts: [],
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const body = rawBody ? JSON.parse(rawBody) : null;

    const send = (status, payload) => {
      res.statusCode = status;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
    };

    if (req.method === 'GET' && url.pathname === '/rest/v1/application_locks') {
      if (!lockRow) return send(200, []);
      return send(200, [lockRow]);
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/applications') {
      return send(200, [state.appRow]);
    }

    if (req.method === 'PATCH' && url.pathname === '/rest/v1/applications') {
      state.appPatchCalls.push(body);
      state.appRow = {
        ...state.appRow,
        ...body,
      };
      return send(200, [state.appRow]);
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/application_steps') {
      state.stepUpserts.push(body);
      if (failStepUpsert) {
        return send(500, { message: 'application_steps upsert failed in fake supabase' });
      }
      return send(201, Array.isArray(body) ? body : [body]);
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/application_history') {
      state.historyInserts.push(body);
      return send(201, [{ id: 'hist-1' }]);
    }

    return send(404, { message: `Unhandled fake supabase endpoint: ${req.method} ${url.pathname}` });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();

  return {
    state,
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

async function createTestApp(fakeUrl) {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';
  process.env.SUPABASE_URL = fakeUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.PORT = '0';
  process.env.HOST = '127.0.0.1';

  const buildServer = await buildServerImport();
  return buildServer();
}

test('workflow complete-step route upserts completion in application_steps', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 2, current_stage: 1 },
    lockRow: { owner_user_id: 'tech-1', expires_at: '2999-01-01T00:00:00.000Z' },
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { stepIndex: 2 },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fake.state.stepUpserts.length, 1);
    assert.deepEqual(fake.state.stepUpserts[0], {
      application_id: 'app-1',
      step_index: 2,
      is_completed: true,
    });
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow complete-step requires active lock and does not upsert when lock is missing', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 2, current_stage: 1 },
    lockRow: null,
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { stepIndex: 2 },
    });

    assert.equal(response.statusCode, 423);
    assert.equal(response.json().code, 'LOCK_REQUIRED');
    assert.equal(fake.state.stepUpserts.length, 0);
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow complete-step idempotency returns cached response without second upsert', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 2, current_stage: 1 },
    lockRow: { owner_user_id: 'tech-1', expires_at: '2999-01-01T00:00:00.000Z' },
  });

  const { app } = await createTestApp(fake.url);
  const request = {
    method: 'POST',
    url: '/api/v1/applications/app-1/workflow/complete-step',
    headers: {
      'x-user-id': 'tech-1',
      'x-user-role': 'technician',
      'x-idempotency-key': 'complete-step-1',
    },
    payload: { stepIndex: 2 },
  };

  try {
    const first = await app.inject(request);
    const second = await app.inject(request);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.deepEqual(second.json(), first.json());
    assert.equal(fake.state.stepUpserts.length, 1);
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow complete-step idempotency rejects key reuse with different payload', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 2, current_stage: 1 },
    lockRow: { owner_user_id: 'tech-1', expires_at: '2999-01-01T00:00:00.000Z' },
  });

  const { app } = await createTestApp(fake.url);
  const headers = {
    'x-user-id': 'tech-1',
    'x-user-role': 'technician',
    'x-idempotency-key': 'complete-step-conflict-1',
  };

  try {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers,
      payload: { stepIndex: 2 },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers,
      payload: { stepIndex: 3 },
    });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 409);
    assert.equal(second.json().code, 'IDEMPOTENCY_CONFLICT');
    assert.equal(fake.state.stepUpserts.length, 1);
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow complete-step rejects invalid step state and does not upsert', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 2, current_stage: 1 },
    lockRow: { owner_user_id: 'tech-1', expires_at: '2999-01-01T00:00:00.000Z' },
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { stepIndex: 5 },
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, 'INVALID_STEP_STATE');
    assert.equal(fake.state.stepUpserts.length, 0);
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow complete-step surfaces DB error when application_steps upsert fails', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 2, current_stage: 1 },
    lockRow: { owner_user_id: 'tech-1', expires_at: '2999-01-01T00:00:00.000Z' },
    failStepUpsert: true,
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { stepIndex: 2 },
    });

    assert.equal(response.statusCode, 500);
    assert.equal(response.json().code, 'DB_ERROR');
    assert.equal(fake.state.stepUpserts.length, 1);
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow rollback-step route clears completion for rolled-back step', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 4, current_stage: 2 },
    lockRow: { owner_user_id: 'tech-1', expires_at: '2999-01-01T00:00:00.000Z' },
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/rollback-step',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { reason: 'Need fix' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fake.state.stepUpserts.length, 1);
    assert.deepEqual(fake.state.stepUpserts[0], {
      application_id: 'app-1',
      step_index: 4,
      is_completed: false,
    });
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow rollback-step requires active lock and does not upsert when lock is missing', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 4, current_stage: 2 },
    lockRow: null,
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/rollback-step',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { reason: 'Need fix' },
    });

    assert.equal(response.statusCode, 423);
    assert.equal(response.json().code, 'LOCK_REQUIRED');
    assert.equal(fake.state.stepUpserts.length, 0);
  } finally {
    await app.close();
    await fake.close();
  }
});


test('workflow rollback-step idempotency rejects key reuse with different payload', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'DRAFT', current_step: 4, current_stage: 2 },
    lockRow: { owner_user_id: 'tech-1', expires_at: '2999-01-01T00:00:00.000Z' },
  });

  const { app } = await createTestApp(fake.url);
  const headers = {
    'x-user-id': 'tech-1',
    'x-user-role': 'technician',
    'x-idempotency-key': 'rollback-step-conflict-1',
  };

  try {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/rollback-step',
      headers,
      payload: { reason: 'Need fix' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/rollback-step',
      headers,
      payload: { reason: 'Need fix 2' },
    });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 409);
    assert.equal(second.json().code, 'IDEMPOTENCY_CONFLICT');
    assert.equal(fake.state.stepUpserts.length, 1);
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow review-approve route marks reviewed stage as verified', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'REVIEW', current_step: 6, current_stage: 2 },
    lockRow: null,
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/review-approve',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { comment: 'ok' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fake.state.stepUpserts.length, 1);
    const payload = fake.state.stepUpserts[0];
    assert.equal(Array.isArray(payload), true);
    assert.deepEqual(payload.map(item => item.step_index), [0, 1, 2, 3, 4, 5]);
    assert.equal(payload.every(item => item.is_verified === true), true);
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow review-approve surfaces DB error when application_steps upsert fails', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'REVIEW', current_step: 6, current_stage: 2 },
    lockRow: null,
    failStepUpsert: true,
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/review-approve',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { comment: 'ok' },
    });

    assert.equal(response.statusCode, 500);
    assert.equal(response.json().code, 'DB_ERROR');
    assert.equal(fake.state.stepUpserts.length, 1);
  } finally {
    await app.close();
    await fake.close();
  }
});

test('workflow review-reject route clears verification for reviewed stage', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'REVIEW', current_step: 9, current_stage: 3 },
    lockRow: null,
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/review-reject',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { reason: 'needs revision' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(fake.state.stepUpserts.length, 1);
    const payload = fake.state.stepUpserts[0];
    assert.equal(Array.isArray(payload), true);
    assert.deepEqual(payload.map(item => item.step_index), [6, 7, 8]);
    assert.equal(payload.every(item => item.is_verified === false), true);
  } finally {
    await app.close();
    await fake.close();
  }
});


test('workflow review-reject surfaces DB error when application_steps upsert fails', async () => {
  const fake = await createFakeSupabaseServer({
    appRow: { id: 'app-1', status: 'IN_PROGRESS', workflow_substatus: 'REVIEW', current_step: 9, current_stage: 3 },
    lockRow: null,
    failStepUpsert: true,
  });

  const { app } = await createTestApp(fake.url);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/review-reject',
      headers: { 'x-user-id': 'tech-1', 'x-user-role': 'technician' },
      payload: { reason: 'needs revision' },
    });

    assert.equal(response.statusCode, 500);
    assert.equal(response.json().code, 'DB_ERROR');
    assert.equal(fake.state.stepUpserts.length, 1);
  } finally {
    await app.close();
    await fake.close();
  }
});
