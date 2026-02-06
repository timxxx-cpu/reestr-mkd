# Быстрое изучение репозитория `reestr-mkd`

## 1) Что это за проект
- Frontend-приложение на **React + Vite** для ведения реестра многоквартирных домов, инвентаризации зданий/помещений и прохождения этапов согласования.
- В UI реализованы роли (техник, контроллер, администратор), этапный workflow и интеграционные шаги для регистрации зданий/помещений.

## 2) Технологический стек
- React 18, Vite 7, React Router, Tailwind.
- TanStack Query для загрузки/кэширования данных.
- Supabase как backend-слой (проекты, заявки, этажи, помещения и т.д.).
- Zod для валидации (схемы и валидаторы в `src/lib`).

## 3) Ключевая структура (актуально после рефакторинга)
- `src/App.jsx` — маршрутизация, экранная композиция, role/persona-поток.
- `src/context/ProjectContext.jsx` — тонкий orchestrator: собирает data/sync/workflow слои и экспортирует стабильный API контекста.
- `src/context/project/useProjectDataLayer.js` — слой **project data**: merge server/local state, `isReadOnly`, validation snapshot.
- `src/context/project/useProjectSyncLayer.js` — слой **sync/save**: буфер `pendingUpdates`, flush «тяжёлых» данных, сериализация save-очереди и согласованный `refetch`.
- `src/context/project/useProjectWorkflowLayer.js` — слой **workflow state**: `completeTask`, `rollbackTask`, `reviewStage`, история этапов.
- `src/lib/workflow-state-machine.js` — единый источник правил переходов и role/status-политик (`canEditByRoleAndStatus`, `get*Transition`).
- `src/lib/api-service.js` — CRUD и маппинг доменной модели в формат БД (Supabase).

## 4) Наблюдения по архитектуре
- Ранее монолитный `ProjectContext` теперь декомпозирован на доменные хуки, что снизило связность и упростило локальную отладку каждого слоя.
- Переходы workflow и правила прав редактирования вынесены в state-machine модуль, что уменьшило риск «разъезда» бизнес-логики.
- Защита от гонок сохранения усилена: используется сериализация `saveProjectImmediate` и единая стратегия `save + refetch`.

## 5) Статус рекомендаций

### Уже реализовано
1. ✅ Вынесен state-machine workflow в отдельный модуль с явными переходами.
2. ✅ Усилена защита от гонок сохранения (`saveProjectImmediate` очередь + согласованный `refetch`).
3. ✅ `ProjectContext` разделён на доменные слои: `workflow state`, `project data`, `sync/save`.

### В работе / следующий приоритет
1. ⏳ Добавить интеграционные тесты на критические сценарии статусов: `NEW → DRAFT → REVIEW → APPROVED/REJECTED → INTEGRATION → COMPLETED`.
2. ⏳ Унифицировать типизацию payload/DTO (JSDoc/TypeScript) между `api-service`, `db-mappers` и UI-моделями.
3. ⏳ Ввести единый словарь ключей/enum для floor/block/unit, чтобы исключить drift между UI и БД.

### Дополнительно (DX/производительность)
1. Снизить размер бандла через lazy-loading редакторов по шагам.
2. Добавить feature-флаги для integration-блоков.
3. Оформить короткий dev-runbook: запуск, диагностика sync-ошибок, воспроизведение типовых кейсов.

## 6) Что запускать локально
```bash
npm ci
npm run dev
npm run lint
npm run build
```

## 7) Что смотреть при глубоком аудите
1. Консистентность key-моделей между UI и БД (`db-mappers`, `api-service`, `reset_schema.sql`).
2. E2E-потоки переходов статусов по ролям и корректность read-only режима на каждом этапе.
3. Нагрузочные/конкурентные сценарии сохранения (массовые изменения матриц + параллельные save-trigger’ы).
4. Соответствие валидаций по шагам (`step-validators`, `validators`, `schemas`) фактическим обязательным полям в UI.

---
Документ обновлён после рефакторинга контекстного слоя, чтобы отражать текущую архитектуру и приоритеты.
