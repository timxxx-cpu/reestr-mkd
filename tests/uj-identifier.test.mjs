import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateProjectCode,
  generateBuildingCode,
  generateUnitCode,
  getBuildingPrefix,
  getUnitPrefix,
  parseIdentifier,
  formatFullIdentifier,
  isValidProjectCode,
  isValidBuildingCode,
  isValidUnitCode,
  extractNumber,
  getNextSequenceNumber,
} from '../src/lib/uj-identifier.js';

// --- PROJECT CODE TESTS ---
test('generateProjectCode: должен генерировать код формата UJ000000', () => {
  assert.equal(generateProjectCode(1), 'UJ000001');
  assert.equal(generateProjectCode(42), 'UJ000042');
  assert.equal(generateProjectCode(999999), 'UJ999999');
  assert.equal(generateProjectCode(0), 'UJ000000');
});

test('isValidProjectCode: должен валидировать UJ-коды', () => {
  assert.equal(isValidProjectCode('UJ000001'), true);
  assert.equal(isValidProjectCode('UJ999999'), true);
  assert.equal(isValidProjectCode('UJ12345'), false);
  assert.equal(isValidProjectCode('AB000001'), false);
  assert.equal(isValidProjectCode('UJ0000AB'), false);
});

// --- BUILDING CODE TESTS ---
test('getBuildingPrefix: должен возвращать правильный префикс', () => {
  assert.equal(getBuildingPrefix('residential', false), 'ZR');
  assert.equal(getBuildingPrefix('residential', true), 'ZM');
  assert.equal(getBuildingPrefix('residential_main', false), 'ZR');
  assert.equal(getBuildingPrefix('residential_main', true), 'ZM');
  assert.equal(getBuildingPrefix('parking_separate'), 'ZP');
  assert.equal(getBuildingPrefix('infrastructure'), 'ZI');
});

test('generateBuildingCode: должен генерировать код формата ZD00', () => {
  assert.equal(generateBuildingCode('ZR', 1), 'ZR01');
  assert.equal(generateBuildingCode('ZM', 5), 'ZM05');
  assert.equal(generateBuildingCode('ZP', 12), 'ZP12');
  assert.equal(generateBuildingCode('ZI', 99), 'ZI99');
});

test('isValidBuildingCode: должен валидировать коды зданий', () => {
  assert.equal(isValidBuildingCode('ZR01'), true);
  assert.equal(isValidBuildingCode('ZM15'), true);
  assert.equal(isValidBuildingCode('ZP99'), true);
  assert.equal(isValidBuildingCode('ZI05'), true);
  assert.equal(isValidBuildingCode('ZR1'), false);
  assert.equal(isValidBuildingCode('AB01'), false);
  assert.equal(isValidBuildingCode('ZR001'), false);
});

// --- UNIT CODE TESTS ---
test('getUnitPrefix: должен возвращать правильный префикс', () => {
  assert.equal(getUnitPrefix('flat'), 'EF');
  assert.equal(getUnitPrefix('duplex_up'), 'EF');
  assert.equal(getUnitPrefix('duplex_down'), 'EF');
  assert.equal(getUnitPrefix('office'), 'EO');
  assert.equal(getUnitPrefix('office_inventory'), 'EO');
  assert.equal(getUnitPrefix('parking_place'), 'EP');
});

test('generateUnitCode: должен генерировать код формата EL000', () => {
  assert.equal(generateUnitCode('EF', 1), 'EF001');
  assert.equal(generateUnitCode('EO', 42), 'EO042');
  assert.equal(generateUnitCode('EP', 123), 'EP123');
  assert.equal(generateUnitCode('EF', 999), 'EF999');
});

test('isValidUnitCode: должен валидировать коды помещений', () => {
  assert.equal(isValidUnitCode('EF001'), true);
  assert.equal(isValidUnitCode('EO123'), true);
  assert.equal(isValidUnitCode('EP999'), true);
  assert.equal(isValidUnitCode('EF12'), false);
  assert.equal(isValidUnitCode('AB001'), false);
  assert.equal(isValidUnitCode('EF0001'), false);
});

// --- FULL IDENTIFIER TESTS ---
test('formatFullIdentifier: должен формировать полный идентификатор', () => {
  assert.equal(formatFullIdentifier('UJ000001', 'ZR01', 'EF001'), 'UJ000001-ZR01-EF001');
  assert.equal(formatFullIdentifier('UJ000042', 'ZM05'), 'UJ000042-ZM05');
  assert.equal(formatFullIdentifier('UJ000001'), 'UJ000001');
  // Если нет здания, помещение не добавляется (иерархия нарушена)
  assert.equal(formatFullIdentifier('UJ000001', null, 'EF001'), 'UJ000001');
});

test('parseIdentifier: должен парсить идентификатор', () => {
  const parsed1 = parseIdentifier('UJ000001-ZR01-EF001');
  assert.equal(parsed1.projectCode, 'UJ000001');
  assert.equal(parsed1.buildingCode, 'ZR01');
  assert.equal(parsed1.unitCode, 'EF001');

  const parsed2 = parseIdentifier('UJ000042-ZM05');
  assert.equal(parsed2.projectCode, 'UJ000042');
  assert.equal(parsed2.buildingCode, 'ZM05');
  assert.equal(parsed2.unitCode, null);

  const parsed3 = parseIdentifier('UJ000001');
  assert.equal(parsed3.projectCode, 'UJ000001');
  assert.equal(parsed3.buildingCode, null);
  assert.equal(parsed3.unitCode, null);
});

// --- UTILITY TESTS ---
test('extractNumber: должен извлекать числовую часть', () => {
  assert.equal(extractNumber('UJ000042'), 42);
  assert.equal(extractNumber('ZR05'), 5);
  assert.equal(extractNumber('EF123'), 123);
  assert.equal(extractNumber(''), 0);
  assert.equal(extractNumber(null), 0);
});

test('getNextSequenceNumber: должен вычислять следующий номер', () => {
  assert.equal(getNextSequenceNumber([]), 1);
  assert.equal(getNextSequenceNumber(['UJ000001', 'UJ000002', 'UJ000005'], 'UJ'), 6);
  assert.equal(getNextSequenceNumber(['ZR01', 'ZR03', 'ZM01'], 'ZR'), 4);
  assert.equal(getNextSequenceNumber(['ZR01', 'ZR03', 'ZM01'], 'ZM'), 2);
  assert.equal(getNextSequenceNumber(['EF001', 'EF005', 'EO001'], 'EF'), 6);
});

// --- INTEGRATION SCENARIOS ---
test('Сценарий: создание нового проекта с зданиями и помещениями', () => {
  // Проект
  const projectCode = generateProjectCode(1);
  assert.equal(projectCode, 'UJ000001');
  assert.equal(isValidProjectCode(projectCode), true);

  // Первое здание (жилой одноблочный)
  const building1Code = generateBuildingCode('ZR', 1);
  assert.equal(building1Code, 'ZR01');
  assert.equal(isValidBuildingCode(building1Code), true);

  // Второе здание (жилой многоблочный)
  const building2Code = generateBuildingCode('ZM', 1);
  assert.equal(building2Code, 'ZM01');

  // Третье здание (паркинг)
  const building3Code = generateBuildingCode('ZP', 1);
  assert.equal(building3Code, 'ZP01');

  // Помещения в первом здании
  const unit1Code = generateUnitCode('EF', 1);
  assert.equal(unit1Code, 'EF001');
  assert.equal(isValidUnitCode(unit1Code), true);

  const unit2Code = generateUnitCode('EF', 2);
  assert.equal(unit2Code, 'EF002');

  const unit3Code = generateUnitCode('EO', 1);
  assert.equal(unit3Code, 'EO001');

  // Полные идентификаторы
  const fullId1 = formatFullIdentifier(projectCode, building1Code, unit1Code);
  assert.equal(fullId1, 'UJ000001-ZR01-EF001');

  const fullId2 = formatFullIdentifier(projectCode, building3Code, 'EP001');
  assert.equal(fullId2, 'UJ000001-ZP01-EP001');

  // Парсинг
  const parsed = parseIdentifier(fullId1);
  assert.equal(parsed.projectCode, projectCode);
  assert.equal(parsed.buildingCode, building1Code);
  assert.equal(parsed.unitCode, unit1Code);
});

test('Сценарий: нумерация в пределах типа', () => {
  // В одном проекте могут быть ZR01 и ZM01 одновременно
  const existingBuildings = ['ZR01', 'ZR02', 'ZM01', 'ZP01'];

  const nextZR = getNextSequenceNumber(existingBuildings, 'ZR');
  assert.equal(nextZR, 3);

  const nextZM = getNextSequenceNumber(existingBuildings, 'ZM');
  assert.equal(nextZM, 2);

  const nextZP = getNextSequenceNumber(existingBuildings, 'ZP');
  assert.equal(nextZP, 2);

  const nextZI = getNextSequenceNumber(existingBuildings, 'ZI');
  assert.equal(nextZI, 1); // Нет ZI в списке
});

test('Сценарий: генерация для разных типов помещений в одном здании', () => {
  const existingUnits = ['EF001', 'EF002', 'EF003', 'EO001', 'EP001', 'EP002'];

  const nextFlat = getNextSequenceNumber(existingUnits, 'EF');
  assert.equal(nextFlat, 4);

  const nextOffice = getNextSequenceNumber(existingUnits, 'EO');
  assert.equal(nextOffice, 2);

  const nextParking = getNextSequenceNumber(existingUnits, 'EP');
  assert.equal(nextParking, 3);
});
