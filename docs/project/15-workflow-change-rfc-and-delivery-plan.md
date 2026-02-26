# 15. RFC-шаблон и план поставки: изменение workflow + frontend refactor

## Зачем этот документ

Документ подготовлен как рабочий шаблон перед двумя задачами:
1) изменение workflow,
2) рефакторинг frontend.

Цель — сначала стабилизировать бизнес-контракт на backend, затем безопасно рефакторить frontend без дрейфа логики.

---

## A. RFC-шаблон для изменения workflow (заполняется перед разработкой)

### A1. Контекст

- **Инициатор**:
- **Дата**:
- **Связанные задачи/issue**:
- **Существующее поведение (as-is)**:
- **Целевое поведение (to-be)**:

### A2. Scope (входит / не входит)

**Входит:**
- [ ] Изменение переходов workflow
- [ ] Изменение RBAC-проверок
- [ ] Изменение API-контракта
- [ ] Обновление истории/audit

**Не входит:**
- [ ] UI-рефакторинг компонентов
- [ ] Изменения схемы вне нужных полей
- [ ] Нефункциональные улучшения без связи с workflow

### A3. Таблица переходов (было → стало)

| Операция | Роль | Предусловие (status/substatus/step) | Было | Стало | Ошибка при нарушении |
|---|---|---|---|---|---|
| COMPLETE_STEP | technician/admin | ... | ... | ... | 409/422 |
| REVIEW_APPROVE | controller/admin | ... | ... | ... | 409/422 |
| REVIEW_REJECT | controller/admin | ... | ... | ... | 409/422 |
| REQUEST_DECLINE | technician | ... | ... | ... | 409/422 |
| DECLINE | branch_manager/admin/(controller?) | ... | ... | ... | 403/409 |
| RETURN_FROM_DECLINE | branch_manager/admin | ... | ... | ... | 409 |
| RESTORE | admin | ... | ... | ... | 403/409 |

### A4. RBAC-матрица (обновляемая)

| Действие | technician | controller | branch_manager | admin |
|---|:---:|:---:|:---:|:---:|
| COMPLETE_STEP |  |  |  |  |
| ROLLBACK_STEP |  |  |  |  |
| REVIEW_APPROVE |  |  |  |  |
| REVIEW_REJECT |  |  |  |  |
| REQUEST_DECLINE |  |  |  |  |
| DECLINE |  |  |  |  |
| RETURN_FROM_DECLINE |  |  |  |  |
| RESTORE |  |  |  |  |

### A5. Данные и аудит (обязательно)

- Затронутые таблицы:
  - `applications`
  - `application_history`
  - `application_steps`
  - (при необходимости) lock/idempotency-таблицы и связанные механизмы.
- Обязательные поля аудита:
  - actor (`user_id`, `role`),
  - operation,
  - old/new state,
  - timestamp,
  - correlation/request-id.

### A6. API-контракт

- Endpoint(ы):
- Request schema:
- Response schema:
- Коды ошибок:
- Идемпотентность:
  - нужен ли `x-idempotency-key`;
  - поведение при re-use с другим payload (ожидаемо `409 IDEMPOTENCY_CONFLICT`).

### A7. Backward compatibility

- [ ] Нет breaking changes
- [ ] Есть breaking changes (описать migration note)
- [ ] Нужен feature-flag
- [ ] Нужен dual-path на переходный период

### A8. План тестирования (definition of done)

**Backend tests:**
- [ ] Happy-path для новых переходов
- [ ] Forbidden по роли (`403`)
- [ ] Invalid-state (`409` / `422`)
- [ ] Idempotency (`same key + same payload` / `same key + different payload`)
- [ ] Audit-history запись проверяется

**Frontend tests:**
- [ ] Корректное отображение доступных действий по роли/подстатусу
- [ ] Ошибки backend корректно отображаются в UI
- [ ] Нет локального fallback-перехода, который расходится с backend

### A9. Документация

- [ ] Обновить `docs/project/05-workflow.md`
- [ ] Обновить `docs/project/09-role-step-data-lifecycle.md` (если затрагивается lifecycle)
- [ ] При изменении API обновить `apps/backend/README.md`
- [ ] Запустить route drift-check (`docs:routes:check`/`docs:routes:sync`)

---

## B. План поставки по двум задачам (рекомендуемый порядок)

## Этап 1 — Изменение workflow (приоритет №1)

1. Зафиксировать RFC по разделу A (без кода).
2. Реализовать backend-изменения policy + route handler + валидации.
3. Добавить/обновить backend тесты на переходы и ошибки.
4. Обновить документацию по workflow и API-контрактам.

**Результат этапа:** backend становится однозначным source-of-truth для нового поведения.

## Этап 2 — Контрактная адаптация frontend

1. Обновить frontend API-слой (`src/lib/api/*`, `src/lib/api-service.js`) под новый контракт.
2. Убедиться, что UI не делает «локальные» workflow-переходы в обход backend.
3. Добавить/обновить smoke/contract проверки на критичные сценарии.

**Результат этапа:** UI полностью синхронизирован с backend поведением.

## Этап 3 — Рефакторинг frontend (приоритет №2)

1. Разбить рефакторинг на небольшие PR (hooks → contexts → components).
2. Не смешивать в одном PR бизнес-изменения workflow и техрефактор UI.
3. Для каждого PR: до/после метрики (размер компонента, дубли, покрытие тестами).

**Результат этапа:** cleaner frontend architecture без регресса бизнес-логики.

---

## C. Практический старт (что делать прямо сейчас)

1. Заполнить разделы A1–A4 (контекст + таблица переходов + RBAC).
2. Согласовать RFC (30–45 мин с командой).
3. Открыть PR-1: backend workflow change + тесты + docs.
4. После merge открыть PR-2: frontend contract alignment.
5. После merge открыть PR-3+: frontend refactor пакетами.

---

## D. Критерии готовности всей инициативы

- [ ] Workflow-правила описаны и реализованы одинаково в docs/backend/frontend.
- [ ] Все критичные переходы закрыты тестами.
- [ ] Ошибки и права ролей предсказуемы и воспроизводимы.
- [ ] Frontend не содержит расхожих с backend fallback-сценариев.
- [ ] Route/docs drift-check проходит стабильно.
