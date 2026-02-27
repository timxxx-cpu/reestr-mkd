import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/lib/step-validators.js', 'utf8');

test('extension entities keep source fields for validateExtensionByStep', () => {
  assert.match(
    source,
    /return\s*\{\s*\.\.\.ext,[\s\S]*kind:\s*'extension'/,
    'getBuildingExtensionsForStatus should spread extension payload so validators receive extension fields'
  );
});

test('registry_res and apartments include extensions of both legacy and current residential block type codes', () => {
  assert.match(
    source,
    /const isResidentialBlockType = type => type === 'Ж' \|\| type === 'residential';/,
    'step validators should treat both "Ж" and "residential" block types as residential'
  );

  assert.match(
    source,
    /registry_res:\s*ext\s*=>\s*isResidentialBlockType\(blocksById\[ext\.parentBlockId\]\?\.type\)/,
    'registry_res extension filtering should use residential type helper'
  );

  assert.match(
    source,
    /apartments:\s*ext\s*=>\s*isResidentialBlockType\(blocksById\[ext\.parentBlockId\]\?\.type\)/,
    'apartments extension filtering should use residential type helper'
  );
});

test('registry_nonres excludes residential and basement block type variants', () => {
  assert.match(
    source,
    /return !isResidentialBlockType\(parent\.type\) && !isBasementBlockType\(parent\.type\);/,
    'registry_nonres extension filtering should exclude residential and basement parents using helpers'
  );

  assert.match(
    source,
    /const isBasementBlockType =\s*type =>[\s\S]*type === 'ПД'[\s\S]*type === 'BAS'[\s\S]*type === 'basement';/,
    'basement helper should account for all supported basement type markers'
  );
});
