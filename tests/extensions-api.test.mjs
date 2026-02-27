import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTemporaryExtensionId,
  isExtensionApiUnavailable,
  isTemporaryExtensionId,
} from '../src/lib/api/extensions-api.js';

test('createTemporaryExtensionId generates expected prefix and unique values', () => {
  const generated = Array.from({ length: 20 }, () => createTemporaryExtensionId());

  generated.forEach(id => {
    assert.equal(typeof id, 'string');
    assert.ok(id.startsWith('tmp-ext-'));
    assert.ok(id.length > 'tmp-ext-'.length);
  });

  assert.equal(new Set(generated).size, generated.length);
});

test('isTemporaryExtensionId detects only generated temp ids', () => {
  const tempId = createTemporaryExtensionId();

  assert.equal(isTemporaryExtensionId(tempId), true);
  assert.equal(isTemporaryExtensionId('tmp-123'), false);
  assert.equal(isTemporaryExtensionId('ext-123'), false);
  assert.equal(isTemporaryExtensionId(null), false);
});

test('isExtensionApiUnavailable recognizes known unavailable endpoint cases', () => {
  assert.equal(isExtensionApiUnavailable({ code: 'NOT_IMPLEMENTED' }), true);
  assert.equal(isExtensionApiUnavailable({ status: 404 }), true);
  assert.equal(isExtensionApiUnavailable({ status: 501 }), true);
  assert.equal(isExtensionApiUnavailable({ message: 'BFF backend is required for operation' }), true);
  assert.equal(isExtensionApiUnavailable({ message: 'Endpoint returned 404 Not Found' }), true);

  assert.equal(
    isExtensionApiUnavailable({
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Validation failed for extension payload',
    }),
    false
  );
});
