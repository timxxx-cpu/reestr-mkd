import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.PORT = process.env.PORT || '8787';
process.env.HOST = process.env.HOST || '127.0.0.1';

const importServer = async () => {
  const mod = await import(`../src/server.js?test=${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return mod.buildServer;
};

const assertErrorContract = (response, expectedCode, expectedStatus) => {
  assert.equal(response.statusCode, expectedStatus);
  const payload = response.json();

  assert.equal(payload.code, expectedCode);
  assert.equal(typeof payload.message, 'string');
  assert.ok(payload.message.length > 0);
  assert.ok(Object.hasOwn(payload, 'details'));
  assert.equal(typeof payload.requestId, 'string');
  assert.ok(payload.requestId.length > 0);
};

test('forbidden response follows unified error contract', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';

  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers: {
        'x-user-id': 'user-1',
        'x-user-role': 'guest',
      },
      payload: { stepIndex: 1 },
    });

    assertErrorContract(response, 'FORBIDDEN', 403);
  } finally {
    await app.close();
  }
});


test('validation response follows unified error contract', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';

  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers: {
        'x-user-id': 'user-1',
        'x-user-role': 'technician',
      },
      payload: { stepIndex: -1 },
    });

    assertErrorContract(response, 'INVALID_STEP_INDEX', 400);
  } finally {
    await app.close();
  }
});


test('unauthorized response follows unified error contract in jwt mode', async () => {
  process.env.AUTH_MODE = 'jwt';
  process.env.JWT_SECRET = 'test-secret';

  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/locks/acquire',
      payload: {},
    });

    assertErrorContract(response, 'UNAUTHORIZED', 401);
  } finally {
    await app.close();
  }
});


test('step-validation endpoint follows unified unauthorized contract in jwt mode', async () => {
  process.env.AUTH_MODE = 'jwt';
  process.env.JWT_SECRET = 'test-secret';

  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/project-1/validation/step',
      payload: { scope: 'shared_dev_env', stepId: 'composition' },
    });

    assertErrorContract(response, 'UNAUTHORIZED', 401);
  } finally {
    await app.close();
  }
});


test('external-applications endpoint validates missing scope with unified error contract', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';

  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/external-applications',
      headers: {
        'x-user-id': 'user-1',
        'x-user-role': 'technician',
      },
    });

    assertErrorContract(response, 'MISSING_SCOPE', 400);
  } finally {
    await app.close();
  }
});
