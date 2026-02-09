# 5. Workflow: роли, статусы, этапы, переходы

## Роли

- `admin` -> **Полный доступ на запись данных и workflow-операции**.
- `technician` -> **Ввод/корректировка данных по шагам**.
- `controller` -> **Проверка этапов, approve/reject без контентного редактирования**.

## Ключевые поля workflow в БД

- `applications.status` -> `applicationInfo.status` -> **Текущий статус заявки**.
- `applications.current_step` -> `applicationInfo.currentStepIndex` -> **Текущий шаг**.
- `applications.current_stage` -> `applicationInfo.currentStage` -> **Текущий этап**.
- `application_steps.is_completed` -> `applicationInfo.completedSteps` -> **Шаг выполнен**.
- `application_steps.is_verified` -> `applicationInfo.verifiedSteps` -> **Шаг подтвержден контролером**.
- `application_history.action/comment/user_name` -> `applicationInfo.history[]` -> **Журнал действий и комментариев**.

## Переходы

### Complete step
- Пишется `applications.status/current_step/current_stage/updated_at`.
- Добавляется `application_history` (действие, комментарий, переход статуса).
- Обновляется `application_steps.is_completed`.

### Rollback step
- Пишется откат в `applications.current_step/current_stage/status`.
- Добавляется запись в `application_history`.
- Корректируется набор `application_steps`.

### Review (APPROVE/REJECT)
- `APPROVE`: обновляет `applications.status`, отмечает `application_steps.is_verified=true`, пишет `application_history`.
- `REJECT`: ставит `applications.status='REJECTED'`, откатывает шаг/этап, пишет причину в `application_history.comment`.
