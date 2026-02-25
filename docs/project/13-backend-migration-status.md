# 13. Статус миграции на backend-first (BFF) — единый документ

## Назначение

Этот файл заменяет прежние разрозненные документы по cutover/rollback/legacy-инвентарю и фиксирует **текущее состояние миграции на BFF** в одном месте.

---

## 1) Текущий статус

**Статус: backend-first активен.**

- Основной путь чтения/записи — через BFF.
- Для write-операций в data-layer используются BFF-only guard-проверки.
- Каталоги обслуживаются через backend API с серверной проверкой прав.
- `AUTH_MODE=dev` запрещён для production-like окружений.

---

## 2) Что уже переведено на BFF

На текущем этапе backend-first покрывает:

- workflow-операции и lock lifecycle;
- серверная фильтрация/поиск/пагинация списка проектов (`GET /api/v1/projects`);
- серверная агрегация дашборд-метрик (`GET /api/v1/projects/summary-counts`);
- project context/meta/save-path;
- composition/floors/entrances/units/common areas/basements/parking;
- integration status + cadastre updates;
- catalog read/write через backend endpoint-ы;
- versioning endpoint-ы (включая policy-gate на write);
- project full registry и связанные агрегированные read-path.

---

## 3) Безопасность и наблюдаемость

- Server-side policy-coverage для write endpoint-ов.
- Единый контракт ошибок (`code/message/details/requestId`) и тесты на него.
- Runtime guard для auth-конфигурации (`AUTH_MODE=dev` не допускается в production-like runtime).
- Correlation headers/logging (`x-request-id`, source-aware логирование).

---

## 4) Release gate (операционный минимум)

Перед релизом выполняются:

1. Backend tests:
   - `npm --prefix apps/backend test`
2. Cutover smoke:
   - `npm run cutover:smoke`
3. Legacy critical-path check:
   - `npm run cutover:legacy-check` (статический guard-check на отсутствие legacy-path-паттернов в `src/lib/api-service.js`)

**Правило:** при критичном провале smoke/critical-path — rollback по аварийному флагу, затем разбор инцидента.

---

## 5) Остаточный rollback-контур

Rollback оставлен только как аварийный механизм.

- Управляется флагом `VITE_LEGACY_ROLLBACK_ENABLED=true`.
- Не используется как штатный runtime-режим.

---

## 6) Что считается «готово»

Миграция считается завершённой, если:

- backend test-suite стабильно зелёный;
- smoke и critical-path проверки зелёные;
- новые изменения не расширяют legacy-поверхность;
- документация поддерживается только в этом едином файле для migration/cutover статуса.
