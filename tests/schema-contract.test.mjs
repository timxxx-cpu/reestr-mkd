import test from 'node:test';
import assert from 'node:assert/strict';


import { UnitSchema, ComplexInfoSchema, BuildingMetaSchema } from '../src/lib/schemas.js';
import { normalizeProjectStatusFromDb, normalizeProjectStatusToDb } from '../src/lib/project-status.js';

test('UnitSchema accepts UUID in entranceId', () => {
  const result = UnitSchema.safeParse({
    id: '11111111-1111-4111-8111-111111111111',
    num: '101',
    type: 'flat',
    entranceId: '22222222-2222-4222-8222-222222222222'
  });

  assert.equal(result.success, true);
});

test('UnitSchema rejects numeric entranceId', () => {
  const result = UnitSchema.safeParse({
    num: '101',
    type: 'flat',
    entranceId: 1
  });

  assert.equal(result.success, false);
});

test('UnitSchema accepts all dict_unit_types codes', () => {
  const supportedTypes = [
    'flat',
    'duplex_up',
    'duplex_down',
    'office',
    'office_inventory',
    'non_res_block',
    'infrastructure',
    'parking_place'
  ];

  for (const type of supportedTypes) {
    const result = UnitSchema.safeParse({ num: '1', type });
    assert.equal(result.success, true, `expected type ${type} to be valid`);
  }
});

test('UnitSchema rejects legacy pantry type', () => {
  const result = UnitSchema.safeParse({ num: '1', type: 'pantry' });
  assert.equal(result.success, false);
});


test('BuildingMetaSchema allows construction stage "Готовый к вводу"', () => {
  const result = BuildingMetaSchema.safeParse({
    id: '33333333-3333-4333-8333-333333333333',
    label: 'Корпус 1',
    houseNumber: '1',
    type: 'Жилой дом',
    category: 'residential',
    stage: 'Готовый к вводу',
    resBlocks: 1,
    nonResBlocks: 0
  });

  assert.equal(result.success, true);
});

test('ComplexInfoSchema and BuildingMetaSchema use consistent stage values', () => {
  const stage = 'Готовый к вводу';
  const projectResult = ComplexInfoSchema.safeParse({
    name: 'ЖК Тест',
    status: stage,
    street: 'ул. Тестовая, 1'
  });

  const buildingResult = BuildingMetaSchema.safeParse({
    id: '44444444-4444-4444-8444-444444444444',
    label: 'Корпус 2',
    houseNumber: '2',
    type: 'Жилой дом',
    category: 'residential',
    stage,
    resBlocks: 1,
    nonResBlocks: 0
  });

  assert.equal(projectResult.success, true);
  assert.equal(buildingResult.success, true);
});


test('project status mapping keeps DB code canonical and UI label readable', () => {
  assert.equal(normalizeProjectStatusFromDb('ready'), 'Готовый к вводу');
  assert.equal(normalizeProjectStatusToDb('Готовый к вводу'), 'ready');
});

test('project status mapping is backward-compatible with already-labeled values', () => {
  assert.equal(normalizeProjectStatusFromDb('Проектный'), 'Проектный');
  assert.equal(normalizeProjectStatusToDb('project'), 'project');
});
