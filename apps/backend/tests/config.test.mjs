import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_ENV = {
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  PORT: '8787',
  HOST: '127.0.0.1',
};

const loadConfig = async () => {
  const mod = await import(`../src/config.js?test=${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return mod.getConfig;
};

const withEnv = async (patch, fn) => {
  const keys = [
    ...Object.keys(BASE_ENV),
    'AUTH_MODE',
    'JWT_SECRET',
    'NODE_ENV',
    'APP_ENV',
    'RUNTIME_ENV',
  ];

  const backup = {};
  for (const key of keys) backup[key] = process.env[key];

  Object.assign(process.env, BASE_ENV);
  for (const key of ['AUTH_MODE', 'JWT_SECRET', 'NODE_ENV', 'APP_ENV', 'RUNTIME_ENV']) {
    delete process.env[key];
  }
  Object.assign(process.env, patch);

  try {
    await fn();
  } finally {
    for (const key of keys) {
      if (backup[key] === undefined) delete process.env[key];
      else process.env[key] = backup[key];
    }
  }
};

test('AUTH_MODE=dev is forbidden in production-like runtime env', async () => {
  await withEnv({ AUTH_MODE: 'dev', NODE_ENV: 'production' }, async () => {
    const getConfig = await loadConfig();
    assert.throws(
      () => getConfig(),
      /AUTH_MODE=dev is forbidden for runtime env: production/
    );
  });
});

test('AUTH_MODE=dev is allowed in dev runtime env', async () => {
  await withEnv({ AUTH_MODE: 'dev', NODE_ENV: 'development' }, async () => {
    const getConfig = await loadConfig();
    const config = getConfig();
    assert.equal(config.authMode, 'dev');
    assert.equal(config.runtimeEnv, 'development');
  });
});

test('AUTH_MODE=jwt still requires JWT_SECRET', async () => {
  await withEnv({ AUTH_MODE: 'jwt', NODE_ENV: 'production', JWT_SECRET: '' }, async () => {
    const getConfig = await loadConfig();
    assert.throws(() => getConfig(), /Missing JWT_SECRET for AUTH_MODE=jwt/);
  });
});
