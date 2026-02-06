# Аудит соответствия схемы БД и кода (DEV / Supabase)

Дата: 2026-02-06

## Область проверки

Проверены:
- SQL-схема и seed: `db/reset_schema.sql`
- workflow и статусы: `src/lib/constants.js`, `src/lib/workflow-state-machine.js`, `src/context/project/useProjectWorkflowLayer.js`
- API-слой и upsert-стратегия: `src/lib/api-service.js`, `docs/upsert-on-conflict.md`
- валидационные схемы: `src/lib/schemas.js`
- runbook: `docs/db-reset-runbook.md`

## Ключевые несоответствия

### 1) `UnitSchema.entranceId` объявлен как `number`, но в БД это `uuid` ✅ Исправлено
- В `units` колонка `entrance_id uuid references entrances(id)`.
- Было: в `UnitSchema` поле `entranceId: z.number().int().optional()`.
- Стало: `entranceId: z.string().uuid().optional()`.
- В загрузке `flatMatrix` теперь `entranceId` передается как `row.entrance_id` (uuid), а номер подъезда хранится отдельно в `entranceIndex`.
- В маппере UI получает `entranceId` как uuid (`u.entrance_id`), отдельно вычисляется `entranceIndex` как number.

**Статус:** риск закрыт правкой схемы и маппинга.

**Результат:** выполнено; в валидаторе шага нумерации сравнение переведено на `entranceIndex` вместо парсинга `entranceId`.

---

### 2) `UnitSchema.type` не совпадает со справочником `dict_unit_types` ✅ Исправлено
- В БД seed: `flat`, `duplex_up`, `duplex_down`, `office`, `office_inventory`, `non_res_block`, `infrastructure`, `parking_place`.
- Было в `UnitSchema`: `flat`, `office`, `pantry`, `duplex_up`, `duplex_down`.
- Стало: enum синхронизирован с `dict_unit_types` — `flat`, `duplex_up`, `duplex_down`, `office`, `office_inventory`, `non_res_block`, `infrastructure`, `parking_place`.

**Риск:** UI может отбрасывать/невалидировать реальные типы из БД; появятся "невидимые" записи в редакторах.

**Результат:** выполнено; в логике проверки нумерации квартир фильтрация переведена на явные жилые типы (`flat`, `duplex_up`, `duplex_down`), чтобы новые нежилые коды не влияли на расчеты.

---

### 3) Несогласованность статусов строительства между `ComplexInfoSchema` и `BuildingMetaSchema` ✅ Исправлено
- `ComplexInfoSchema.status` содержит `"Готовый к вводу"`.
- Было: `BuildingMetaSchema.stage` не содержал `"Готовый к вводу"`.
- Стало: `BuildingMetaSchema.stage` приведен к тому же набору статусов, что и `ComplexInfoSchema`.

**Риск:** ошибка валидации для части данных при нормализации/копировании статуса.

**Результат:** выполнено на уровне схем; добавлены контрактные тесты на согласованность значений `Готовый к вводу` в обеих схемах.

---

### 4) Drift между кодами и лейблами в `dict_project_statuses` и UI-статусами ✅ Исправлено
- В `dict_project_statuses` в БД seed: коды `project/building/ready/done`, лейблы русские.
- В коде проектные поля обычно сохраняют/ожидают сразу русские лейблы (`Проектный`, `Строящийся`, `Готовый к вводу`, `Введенный`).

**Риск:** при переходе на строгую каталогизацию/фильтрацию по кодам можно получить рассинхрон.

**Результат:** выполнено — `projects.construction_status` сохраняется в canonical-коде (`project/building/ready/done`), а в UI отображается label через двунаправленную нормализацию (`normalizeProjectStatusToDb`/`normalizeProjectStatusFromDb`).

---

### 5) Документация runbook отстает от текущей сетки шагов ✅ Исправлено
- В runbook smoke-check: `Step 10-14: реестры и интеграция`.
- В `STEPS_CONFIG` всего 17 шагов (индексы 0..16), интеграция начинается с индекса 12.

**Риск:** ручные проверки после reset выполняются по устаревшей инструкции.

**Результат:** выполнено — runbook обновлен под фактические индексы `STEPS_CONFIG` (0..16), добавлены подробный smoke-check и раздел с вариантами по спорному поведению шага 11→12.

---

### 6) Граница этапа и старт интеграции срабатывают одновременно на шаге 11
- В state-machine на шаге-границе приоритет у `REVIEW`, даже если следующий шаг — начало интеграции (`isIntegrationStart=true`).
- Это зафиксировано smoke-тестом.

**Риск:** риск не баговый, но семантически спорно: пользователю может казаться, что интеграция должна начинаться сразу после завершения шага 11, однако сначала идет review.

**Рекомендация:** подтвердить бизнес-правило (текущее поведение выглядит осознанным), добавить явный комментарий в workflow-документацию.

## Что уже сделано хорошо

- Есть централизованная карта `UPSERT_ON_CONFLICT` + guard на отсутствие ключа.
- В схеме добавлены уникальности, критичные для идемпотентного upsert (`application_steps`, `entrance_matrix`, `basement_parking_levels`, `block_floor_markers`).
- DEV reset повторяемый и включает минимальный seed каталога.

## Приоритет исправлений

1. **Низкий/архитектурный:** п.6 (явность бизнес-правила review перед integration).
