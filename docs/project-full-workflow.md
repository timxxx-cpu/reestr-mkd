# Полное описание Workflow, статусов и логики переходов

Источник логики:

- `src/lib/constants.js`
- `src/lib/workflow-state-machine.js`
- `src/lib/workflow-utils.js`
- `src/context/project/useProjectWorkflowLayer.js`
- `tests/workflow-smoke.test.mjs`

## 1. Сущности процесса

Workflow привязан к `applications` и опирается на поля:

- `status`
- `current_step`
- `current_stage`
- `integration_data`

Дополнительно на UI-стороне используются:

- `completedSteps`
- `verifiedSteps`
- `history`
- `rejectionReason`

---

## 2. Роли и права редактирования

Правило `canEditByRoleAndStatus`:

- `admin`: всегда может редактировать;
- `controller`: не редактирует данные шагов (режим проверки);
- `technician`: редактирует только в статусах `DRAFT`, `NEW`, `REJECTED`, `INTEGRATION`.

Следствие: в статусе `REVIEW` редактирование закрыто для техника.

---

## 3. Статусы заявки

- `NEW` — новая заявка
- `DRAFT` — в работе
- `REVIEW` — отправлена на проверку
- `APPROVED` — принято
- `REJECTED` — возврат на доработку
- `INTEGRATION` — этап интеграции
- `COMPLETED` — финально закрыта

В UI каждому статусу соответствует label + color token.

---

## 4. Этапы workflow

Конфиг этапов (`WORKFLOW_STAGES`):

- Этап 1 → последний шаг `5`
- Этап 2 → последний шаг `8`
- Этап 3 → последний шаг `11`
- Этап 4 → последний шаг `16`

Функция `getStepStage(stepIdx)` определяет этап по индексу шага.

---

## 5. Полный список шагов (0..16)

1. `passport` — Паспорт жилого комплекса
2. `composition` — Здания и сооружения
3. `registry_nonres` — Нежилые блоки и инфраструктура
4. `registry_res` — Жилые блоки
5. `floors` — Внешняя инвентаризация
6. `entrances` — Инвентаризация подъездов
7. `apartments` — Нумерация квартир
8. `mop` — МОП
9. `parking_config` — Конфигурация паркинга
10. `registry_apartments` — Реестр квартир
11. `registry_commercial` — Реестр нежилых
12. `registry_parking` — Реестр машиномест
13. `integration_buildings` — Интеграция (здания)
14. `integration_units` — Интеграция (помещения)
15. `registry_nonres_view` — Сводный нежилой реестр
16. `registry_res_view` — Сводный жилой реестр
17. `summary` — Итоговая сводная

---

## 6. State machine переходов

## 6.1 COMPLETE_STEP

Функция: `getCompletionTransition(currentAppInfo, currentIndex)`.

Логика приоритета:

1. Если это глобальный финальный шаг (`nextStepIndex >= STEPS_CONFIG.length`) → `COMPLETED`.
2. Иначе если шаг — граница этапа (`isStageBoundary`) → `REVIEW` и `nextStage = currentStage + 1`.
3. Иначе если следующий шаг — старт интеграции (`nextStepIndex === 12`) → `INTEGRATION`.
4. Иначе статус сохраняется.

Важно: на переходе 11→12 одновременно верны «граница этапа» и «старт интеграции», но по приоритету остается `REVIEW`.

## 6.2 ROLLBACK_STEP

Функция: `getRollbackTransition(currentAppInfo)`.

- `prevIndex = max(0, currentStepIndex - 1)`
- если текущий статус `COMPLETED` или `REVIEW`, то откат переводит в `DRAFT`
- `nextStage = getStepStage(prevIndex)`

## 6.3 REVIEW_APPROVE / REVIEW_REJECT

Функция: `getReviewTransition(currentAppInfo, action)`.

### APPROVE

- базово статус становится `DRAFT`
- если `currentStepIndex === 12`, статус становится `INTEGRATION`
- stage остается текущим

### REJECT

- stage откатывается на предыдущий (`currentStage - 1`, минимум 1)
- step переходит на `lastStepIndex` предыдущего этапа
- статус `REJECTED`

---

## 7. Workflow Layer (прикладные эффекты)

`useProjectWorkflowLayer` добавляет к state-machine прикладные действия:

1. форс-сохранение pending изменений перед переходом;
2. обновление массивов `completedSteps` / `verifiedSteps`;
3. формирование `historyItem` (кто, что, когда, комментарий, prev/next статус);
4. сохранение через `ApiService.saveData`;
5. `refetch()` после перехода.

---

## 8. Журнал истории

История хранит:

- `action` (например, «Отправка на проверку», «Возврат задачи»);
- `comment` (в т.ч. системно-сгенерированный текст);
- `prevStatus`, `nextStatus`;
- `stage`, `stepIndex`;
- метку времени и пользователя.

Это ключевой аудит-трейл процесса.

---

## 9. Проверки workflow тестами

`tests/workflow-smoke.test.mjs` проверяет:

- обычный complete шага;
- перевод в `REVIEW` на границе этапа;
- спорное правило 11→12 (должен остаться `REVIEW`);
- закрытие на финальном шаге;
- rollback из `REVIEW` в `DRAFT`;
- approve/reject переходы ревью.

---

## 10. Практическое чтение статуса процесса

Если нужно быстро диагностировать кейс:

1. посмотреть `current_step` и `current_stage`;
2. сверить, является ли шаг границей этапа;
3. проверить, не произошел ли переход 11→12 с ожидаемым `REVIEW`;
4. сравнить `completedSteps` и `verifiedSteps`;
5. открыть последние записи `application_history`.

Так почти всегда быстро локализуется ошибка: бизнес-правило vs UI-ожидание.
