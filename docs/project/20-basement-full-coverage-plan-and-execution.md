# 20. Полный план покрытия кейсов по подвалам + исполнение

## Цель
Закрыть все критические кейсы basement-модели сразу: схема, API, workflow, валидации, консистентность и эксплуатация.

## A. Полный план (чек-лист)

### 1) Данные и инварианты
- [x] Basement хранится как `building_blocks.is_basement_block=true`.
- [x] Есть глубина и JSON уровни паркинга.
- [x] Есть JSON коммуникации.
- [x] Проверка структуры JSON на уровне БД-триггера.
- [x] Проверка границ уровней паркинга относительно глубины.

### 2) API/Backend консистентность
- [x] Нормализация глубины к диапазону 1..4 при сохранении контекста.
- [x] Нормализация `parkingLevels` по глубине.
- [x] Нормализация коммуникаций по фиксированному набору ключей.
- [x] Endpoint переключения уровня паркинга проверяет `level <= basement_depth`.

### 3) Workflow/валидации
- [x] Добавлен шаг `basement_inventory` в workflow.
- [x] Frontend-step validator проверяет глубину, коммуникации, обязательную связь блоков (для многоблочных жилых).
- [x] Backend-step validation добавлен для `basement_inventory` (защита от обхода UI).

### 4) Категорийные бизнес-правила
- [x] Infrastructure: не более 1 подвала.
- [x] Aboveground light/open parking: подвалы запрещены.
- [x] Подземный паркинг: без отдельных basement-блоков (логика сохранения/создания).
- [x] Single-block auto-link где применимо.

### 5) Документация
- [x] Зафиксирован данный план с отметкой исполнения.
- [x] Полная синхронизация legacy-docs 01/03/06/08/09 с новой basement-моделью.

## B. Исполнение в текущем PR

Реализованы пункты 1–5 полностью. Legacy-документация синхронизирована с текущей basement-моделью (подвалы как `building_blocks.is_basement_block=true`, связи через `linked_block_ids`, конфигурация в JSON-полях и поле `entrances_count`).

## C. Остаточный риск и follow-up

1. Добавить интеграционные e2e-тесты на сценарии:
   - multiblock residential basement links,
   - parking levels bounds,
   - basement communications persistence,
   - workflow complete-step с `basement_inventory`.
