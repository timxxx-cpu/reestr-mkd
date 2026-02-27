import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const floorMatrixEditorSource = readFileSync('src/features/steps/shared/FloorMatrixEditor.jsx', 'utf8');
const apartmentsRegistrySource = readFileSync('src/features/steps/registry/views/ApartmentsRegistry.jsx', 'utf8');
const standardViewSource = readFileSync('src/features/steps/configurator/views/StandardView.jsx', 'utf8');
const infraViewSource = readFileSync('src/features/steps/configurator/views/InfrastructureView.jsx', 'utf8');
const parkingViewSource = readFileSync('src/features/steps/configurator/views/ParkingView.jsx', 'utf8');
const extensionsApiSource = readFileSync('src/lib/api/extensions-api.js', 'utf8');

test('extensions-api exposes rollout feature flags with safe defaults', () => {
  assert.match(extensionsApiSource, /isExtensionsFeatureEnabled[\s\S]*VITE_EXTENSIONS_ENABLED', true/);
  assert.match(
    extensionsApiSource,
    /isExtensionsLocalFallbackEnabled[\s\S]*VITE_EXTENSIONS_LOCAL_FALLBACK_ENABLED', true/
  );
});

test('FloorMatrixEditor supports extension tabs and floor scoping by extensionId', () => {
  assert.match(floorMatrixEditorSource, /extensionTargets\s*=\s*useMemo\(/);
  assert.match(floorMatrixEditorSource, /blockTargets\.map\(target => \{/);
  assert.match(
    floorMatrixEditorSource,
    /activeTarget\.kind === 'extension'[\s\S]*floors\.filter\(f => f\.extensionId === activeTarget\.id\)/
  );
});

test('ApartmentsRegistry supports extension tabs and scoped floor filtering', () => {
  assert.match(apartmentsRegistrySource, /EXTENSION_TAB_PREFIX = 'ext:'/);
  assert.match(apartmentsRegistrySource, /activeExtensionId/);
  assert.match(apartmentsRegistrySource, /allFloors\.filter\(f => f\.extensionId === activeExtensionId\)/);
  assert.match(apartmentsRegistrySource, /setActiveBlockId\(`\$\{EXTENSION_TAB_PREFIX\}\$\{ext\.id\}`\)/);
});

test('Configurator views honor extension feature flags and card disable mode', () => {
  [standardViewSource, infraViewSource, parkingViewSource].forEach(source => {
    assert.match(source, /isExtensionsFeatureEnabled\(\)/);
    assert.match(source, /isExtensionsLocalFallbackEnabled\(\)/);
    assert.match(source, /disabled=\{!extensionsFeatureEnabled\}/);
  });
});
