# Система трёхуровневых UJ-идентификаторов

## Обзор

В проекте реализована иерархическая система идентификации объектов недвижимости по стандарту **UJ (Uy Joy — универсальный узел учёта)**.

Формат: `UJ000000-ZD00-EL000`

## Структура идентификаторов

### Уровень I: Проект (Жилой комплекс)

**Формат:** `UJ000000`

- **Префикс:** `UJ` (Uy Joy)
- **Цифровой блок:** 6 знаков (порядковый номер в системе)
- **Примеры:** `UJ000001`, `UJ000042`, `UJ123456`

**Генерация:**
- Автоматически при создании проекта
- Уникален в пределах `scope_id`
- Хранится в поле `projects.uj_code`

### Уровень II: Здание / Сооружение

**Формат:** `ZD00` (где D — тип здания)

#### Типы зданий и префиксы:

| Код | Тип | Описание |
|-----|-----|----------|
| `ZR` | Residential (single) | Жилой дом (одноблочный) |
| `ZM` | Multi-block | Многоблочный жилой дом |
| `ZP` | Parking | Паркинг (наземный, подземный, пристроенный) |
| `ZI` | Infrastructure | Объект инфраструктуры (сады, школы, ТЦ, котельные) |

**Примеры:** `ZR01`, `ZM03`, `ZP05`, `ZI02`

**Ключевые особенности:**
- Нумерация ведётся **в пределах типа** внутри проекта
- В одном ЖК могут существовать одновременно: `ZR01`, `ZM01`, `ZP01`, `ZI01`
- Автоматически определяется при создании здания на основе категории и количества блоков
- Хранится в поле `buildings.building_code`

#### Логика определения префикса:

```javascript
// Одноблочный жилой дом
category = 'residential', blocks = 1 → ZR

// Многоблочный жилой дом
category = 'residential', blocks > 1 → ZM

// Паркинг
category = 'parking_separate' → ZP

// Инфраструктура
category = 'infrastructure' → ZI
```

### Уровень III: Помещение (Элемент учёта)

**Формат:** `EL000` (где L — тип помещения)

#### Типы помещений и префиксы:

| Код | Тип | Описание |
|-----|-----|----------|
| `EF` | Flat | Квартира (включая дуплексы) |
| `EO` | Office/Commercial | Коммерческое помещение / Офис |
| `EP` | Parking | Машиноместо |

**Примеры:** `EF001`, `EF042`, `EO005`, `EP123`

**Ключевые особенности:**
- Нумерация ведётся **в пределах типа** внутри здания
- В одном здании могут быть: `EF001`, `EF002`, `EO001`, `EP001`
- Автоматически генерируется при создании помещения
- Хранится в поле `units.unit_code`

#### Маппинг типов помещений:

```javascript
'flat'           → EF
'duplex_up'      → EF
'duplex_down'    → EF
'office'         → EO
'office_inventory' → EO
'non_res_block'  → EO
'parking_place'  → EP
```

## Полные идентификаторы

### Примеры полных идентификаторов:

```
UJ000001-ZR01-EF001  // Квартира №1 в жилом доме №1 комплекса №1
UJ000001-ZR01-EF042  // Квартира №42 в жилом доме №1 комплекса №1
UJ000001-ZM02-EF001  // Квартира №1 в многоблочном доме №2 комплекса №1
UJ000001-ZP01-EP123  // Машиноместо №123 в паркинге №1 комплекса №1
UJ000042-ZI01-EO005  // Коммерческое помещение №5 в инфраструктуре №1 комплекса №42
```

### Частичные идентификаторы:

```
UJ000001             // Только проект
UJ000001-ZR01        // Проект + здание
```

## Техническая реализация

### Структура БД

```sql
-- Проекты
ALTER TABLE projects ADD COLUMN uj_code text;
CREATE UNIQUE INDEX idx_projects_uj_code ON projects(uj_code) WHERE uj_code IS NOT NULL;

-- Здания
ALTER TABLE buildings ADD COLUMN building_code text;
CREATE UNIQUE INDEX idx_buildings_code ON buildings(building_code) WHERE building_code IS NOT NULL;

-- Помещения
ALTER TABLE units ADD COLUMN unit_code text;
CREATE UNIQUE INDEX idx_units_code ON units(unit_code) WHERE unit_code IS NOT NULL;
```

### Утилита генерации

**Файл:** `src/lib/uj-identifier.js`

#### Основные функции:

```javascript
// Генерация кодов
generateProjectCode(sequenceNumber)     // → UJ000000
generateBuildingCode(prefix, number)    // → ZD00
generateUnitCode(prefix, number)        // → EL000

// Определение префиксов
getBuildingPrefix(category, hasMultipleBlocks) // → ZR|ZM|ZP|ZI
getUnitPrefix(unitType)                         // → EF|EO|EP

// Работа с полными идентификаторами
formatFullIdentifier(projectCode, buildingCode, unitCode) // → UJ000000-ZD00-EL000
parseIdentifier(identifier)  // → { projectCode, buildingCode, unitCode }

// Валидация
isValidProjectCode(code)   // → boolean
isValidBuildingCode(code)  // → boolean
isValidUnitCode(code)      // → boolean

// Утилиты
extractNumber(code)                    // → number
getNextSequenceNumber(existingCodes, prefix) // → number
```

### Автоматическая генерация

#### При создании проекта:

```javascript
// api-service.js → createProjectFromApplication
const ujCode = await generateNextProjectCode(scope);
// INSERT projects SET uj_code = 'UJ000001'
```

#### При создании здания:

```javascript
// api-service.js → createBuilding
const blocksCount = blocksData.length;
const buildingCode = await generateNextBuildingCode(
  projectId,
  buildingData.category,
  blocksCount
);
// INSERT buildings SET building_code = 'ZR01'
```

#### При создании помещения:

```javascript
// api-service.js → upsertUnit
if (!unitCode && unitData.floorId && unitData.type) {
  // Получаем buildingId через floor → block → building
  unitCode = await generateNextUnitCode(buildingId, unitData.type);
}
// INSERT units SET unit_code = 'EF001'
```

### Маппинг данных

**Файл:** `src/lib/db-mappers.js`

Все мапперы обновлены для возврата новых полей:

```javascript
// mapProjectAggregate
return {
  ujCode: project.uj_code,
  complexInfo: {
    ujCode: project.uj_code,
    // ...
  }
};

// mapBuildingFromDB
return {
  buildingCode: b.building_code,
  // ...
};

// mapUnitFromDB
return {
  unitCode: u.unit_code,
  // ...
};
```

## Отображение в UI

### PassportEditor (Паспорт проекта)

UJ-код отображается в заголовке рядом с названием проекта:

```jsx
{complexInfo?.ujCode && (
  <div className="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-400/30">
    {complexInfo.ujCode}
  </div>
)}
```

### CompositionEditor (Список зданий)

Building-код отображается рядом с названием здания:

```jsx
{item.buildingCode && (
  <div className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">
    {item.buildingCode}
  </div>
)}
```

### ApartmentsRegistry (Реестр квартир)

Unit-код отображается под номером квартиры:

```jsx
{item.unitCode && (
  <span className="text-[9px] font-mono font-bold text-blue-600">
    {item.unitCode}
  </span>
)}
```

## Тестирование

### Unit-тесты

**Файл:** `tests/uj-identifier.test.mjs`

Запуск:
```bash
node --test tests/uj-identifier.test.mjs
```

**Покрытие:**
- ✅ Генерация кодов всех уровней
- ✅ Валидация форматов
- ✅ Определение префиксов
- ✅ Форматирование и парсинг полных идентификаторов
- ✅ Извлечение номеров и вычисление следующих значений
- ✅ Интеграционные сценарии создания объектов
- ✅ Нумерация в пределах типов

**Результаты:** 15/15 тестов успешно ✅

## Примеры использования

### Сценарий 1: Создание нового жилого комплекса

```javascript
// 1. Создаём проект
const projectId = await ApiService.createProject('ЖК Солнечный');
// Автоматически: uj_code = 'UJ000001'

// 2. Добавляем первое жилое здание (одноблочное)
await ApiService.createBuilding(projectId, {
  category: 'residential',
  label: 'Корпус А',
  houseNumber: '1'
}, [{ type: 'residential', floorsCount: 10 }]);
// Автоматически: building_code = 'ZR01'

// 3. Добавляем второе жилое здание (многоблочное)
await ApiService.createBuilding(projectId, {
  category: 'residential',
  label: 'Корпус Б',
  houseNumber: '2'
}, [
  { type: 'residential', floorsCount: 10 },
  { type: 'residential', floorsCount: 12 }
]);
// Автоматически: building_code = 'ZM01'

// 4. Добавляем паркинг
await ApiService.createBuilding(projectId, {
  category: 'parking_separate',
  label: 'Паркинг',
  parkingType: 'underground'
}, [{ type: 'parking' }]);
// Автоматически: building_code = 'ZP01'

// 5. Создаём квартиры в первом здании
await ApiService.upsertUnit({
  floorId: floor1Id,
  type: 'flat',
  number: '1'
});
// Автоматически: unit_code = 'EF001'

await ApiService.upsertUnit({
  floorId: floor1Id,
  type: 'flat',
  number: '2'
});
// Автоматически: unit_code = 'EF002'

// 6. Создаём коммерческое помещение
await ApiService.upsertUnit({
  floorId: floor1Id,
  type: 'office',
  number: '100'
});
// Автоматически: unit_code = 'EO001'

// 7. Создаём машиноместо в паркинге
await ApiService.upsertUnit({
  floorId: parkingFloorId,
  type: 'parking_place',
  number: 'P-001'
});
// Автоматически: unit_code = 'EP001'
```

**Результат:**
```
UJ000001             // Проект
UJ000001-ZR01        // Корпус А
UJ000001-ZM01        // Корпус Б
UJ000001-ZP01        // Паркинг
UJ000001-ZR01-EF001  // Квартира 1 в корпусе А
UJ000001-ZR01-EF002  // Квартира 2 в корпусе А
UJ000001-ZR01-EO001  // Коммерция в корпусе А
UJ000001-ZP01-EP001  // Машиноместо в паркинге
```

### Сценарий 2: Нумерация в пределах типа

```javascript
// В проекте UJ000001 есть:
buildings = [
  'ZR01', // Первый одноблочный жилой дом
  'ZR02', // Второй одноблочный жилой дом
  'ZM01', // Первый многоблочный жилой дом
  'ZP01', // Первый паркинг
  'ZI01'  // Первая инфраструктура
]

// Добавляем новое здание каждого типа:
generateBuildingCode('ZR', getNextSequenceNumber(buildings, 'ZR')) // → ZR03
generateBuildingCode('ZM', getNextSequenceNumber(buildings, 'ZM')) // → ZM02
generateBuildingCode('ZP', getNextSequenceNumber(buildings, 'ZP')) // → ZP02
generateBuildingCode('ZI', getNextSequenceNumber(buildings, 'ZI')) // → ZI02
```

## Миграция существующих данных

Для существующих проектов, зданий и помещений без кодов можно выполнить миграцию:

```sql
-- 1. Генерация UJ-кодов для проектов
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY scope_id ORDER BY created_at) as rn
  FROM projects
  WHERE uj_code IS NULL
)
UPDATE projects p
SET uj_code = 'UJ' || LPAD(numbered.rn::text, 6, '0')
FROM numbered
WHERE p.id = numbered.id;

-- 2. Генерация кодов зданий (выполнить для каждого типа)
-- Для ZR (одноблочные жилые)
WITH numbered AS (
  SELECT b.id, ROW_NUMBER() OVER (PARTITION BY b.project_id ORDER BY b.created_at) as rn
  FROM buildings b
  LEFT JOIN building_blocks bb ON bb.building_id = b.id
  WHERE b.building_code IS NULL 
    AND b.category = 'residential'
    AND (SELECT COUNT(*) FROM building_blocks WHERE building_id = b.id AND type = 'Ж') = 1
)
UPDATE buildings b
SET building_code = 'ZR' || LPAD(numbered.rn::text, 2, '0')
FROM numbered
WHERE b.id = numbered.id;

-- Аналогично для ZM, ZP, ZI...

-- 3. Генерация кодов помещений (выполнить для каждого типа)
-- Для квартир (EF)
WITH building_context AS (
  SELECT u.id as unit_id, 
         bl.building_id,
         ROW_NUMBER() OVER (PARTITION BY bl.building_id ORDER BY u.created_at) as rn
  FROM units u
  JOIN floors f ON f.id = u.floor_id
  JOIN building_blocks bl ON bl.id = f.block_id
  WHERE u.unit_code IS NULL
    AND u.unit_type IN ('flat', 'duplex_up', 'duplex_down')
)
UPDATE units u
SET unit_code = 'EF' || LPAD(bc.rn::text, 3, '0')
FROM building_context bc
WHERE u.id = bc.unit_id;

-- Аналогично для EO, EP...
```

## Рекомендации

### DO ✅

- Используйте автоматическую генерацию кодов через API
- Проверяйте уникальность кодов в пределах scope
- Сохраняйте иерархию: проект → здание → помещение
- Используйте валидацию перед сохранением
- Отображайте коды в UI для удобства навигации

### DON'T ❌

- Не создавайте коды вручную без проверки уникальности
- Не изменяйте существующие коды после создания
- Не нарушайте формат (всегда используйте правильное количество цифр)
- Не используйте коды помещений без привязки к зданию
- Не полагайтесь на порядковые номера как на бизнес-логику

## Дополнительная информация

### Связанные файлы

- `src/lib/uj-identifier.js` — утилиты генерации и валидации
- `src/lib/api-service.js` — интеграция генерации в API
- `src/lib/db-mappers.js` — маппинг данных БД ↔ UI
- `db/reset_schema.sql` — схема БД с новыми полями
- `tests/uj-identifier.test.mjs` — unit-тесты

### Документация проекта

- [Архитектура](./project-full-architecture.md)
- [Схема БД](./project-full-db-schema.md)
- [Workflow](./project-full-workflow.md)

---

**Версия документа:** 1.0  
**Дата:** 9 февраля 2026  
**Автор:** Система UJ-идентификаторов
