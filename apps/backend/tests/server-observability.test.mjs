import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.PORT = process.env.PORT || '8787';
process.env.HOST = process.env.HOST || '127.0.0.1';

const buildHs256Token = ({ sub, role, exp }, secret) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub, role, exp })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
};

const importServer = async () => {
  const mod = await import(`../src/server.js?test=${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return mod.buildServer;
};

test('health endpoint returns request-id and echoes operation-source header', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';
  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-operation-source': 'legacy',
        'x-client-request-id': 'fe-test-1',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['x-request-id']);
    assert.equal(response.headers['x-operation-source'], 'legacy');
    assert.deepEqual(response.json(), { ok: true });
  } finally {
    await app.close();
  }
});

test('health endpoint uses unknown operation-source when header is missing', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';
  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['x-request-id']);
    assert.equal(response.headers['x-operation-source'], 'unknown');
  } finally {
    await app.close();
  }
});

test('jwt auth mode rejects protected route without bearer token', async () => {
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

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, 'UNAUTHORIZED');
  } finally {
    await app.close();
  }
});

test('jwt auth mode accepts signed bearer token and passes auth gate', async () => {
  process.env.AUTH_MODE = 'jwt';
  process.env.JWT_SECRET = 'test-secret';
  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const token = buildHs256Token(
      {
        sub: 'test-user',
        role: 'technician',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.JWT_SECRET
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/locks/acquire',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {},
    });

    assert.notEqual(response.statusCode, 401);
  } finally {
    await app.close();
  }
});

test('workflow mutate endpoint is policy-protected for unknown role', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';
  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/complete-step',
      headers: {
        'x-user-id': 'test-user',
        'x-user-role': 'guest',
      },
      payload: { stepIndex: 1 },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, 'FORBIDDEN');
  } finally {
    await app.close();
  }
});

test('assign-technician endpoint enforces workflow action policy', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';
  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/applications/app-1/workflow/assign-technician',
      headers: {
        'x-user-id': 'test-user',
        'x-user-role': 'technician',
      },
      payload: { assigneeUserId: 'next-tech' },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, 'FORBIDDEN');
  } finally {
    await app.close();
  }
});


test('version approve endpoint denies technician by policy', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';
  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/versions/ver-1/approve',
      headers: {
        'x-user-id': 'test-user',
        'x-user-role': 'technician',
      },
      payload: {},
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, 'FORBIDDEN');
  } finally {
    await app.close();
  }
});

test('version approve endpoint allows controller through policy gate', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';
  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/versions/ver-1/approve',
      headers: {
        'x-user-id': 'controller-user',
        'x-user-role': 'controller',
      },
      payload: {},
    });

    assert.notEqual(response.statusCode, 403);
  } finally {
    await app.close();
  }
});

test('version restore endpoint allows branch_manager through policy gate', async () => {
  process.env.AUTH_MODE = 'dev';
  process.env.JWT_SECRET = '';
  const buildServer = await importServer();
  const { app } = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/versions/ver-1/restore',
      headers: {
        'x-user-id': 'manager-user',
        'x-user-role': 'branch_manager',
      },
      payload: {},
    });

    assert.notEqual(response.statusCode, 403);
  } finally {
    await app.close();
  }
});
