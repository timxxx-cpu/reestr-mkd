# План внедрения справочников и админки

## 1) Что уже сейчас нужно вынести в справочники

### 1.1 Статусы и внешние системы
- `APP_STATUS`/`APP_STATUS_LABELS` в `src/lib/constants.js`.
- `EXTERNAL_SYSTEMS` в `src/lib/constants.js`.

### 1.2 Конструктив / классификаторы блоков
- Опции `foundation`, `walls`, `slabs`, `roof` в `ConstructiveCard`.
- `parkingType`, `lightStructureType`, `infraType` (используются в Composition/Configurator и в валидации).

### 1.3 Типы помещений и МОП
- Типы unit (`flat`, `office`, `pantry`, `parking_place`, `duplex_*`) — используются в матрицах, реестрах и интеграции.
- `MOP_TYPES` в `src/components/editors/MopEditor.jsx`.

### 1.4 Статусы проекта (строительная стадия)
- enum/списки `Проектный/Строящийся/...` в схемах и UI.

---

## 2) Что уже добавлено в БД

Создан отдельный SQL-скрипт `migration_catalogs.sql` с таблицами и первичными seed:
- `dict_project_statuses`
- `dict_application_statuses`
- `dict_external_systems`
- `dict_foundations`
- `dict_wall_materials`
- `dict_slab_types`
- `dict_roof_types`
- `dict_light_structure_types`
- `dict_parking_types`
- `dict_parking_construction_types`
- `dict_infra_types`
- `dict_mop_types`
- `dict_unit_types`

Во всех таблицах одинаковая модель:
- `code` (уникальный бизнес-ключ)
- `label` (отображаемое имя)
- `sort_order`
- `is_active`

Также включены RLS + `Public All` policy для DEV режима.

---

## 3) Предложение по админке (MVP)

## Раздел: **Администрирование → Справочники**

### 3.1 Экран списка справочников
Показывает карточки справочников с:
- Название
- Кол-во активных элементов
- Дата последнего изменения

### 3.2 Экран редактора справочника
Таблица строк:
- `code` (readonly после создания)
- `label`
- `sort_order`
- `is_active`

Операции:
- Добавить строку
- Редактировать
- Деактивировать (soft-delete через `is_active=false`)
- Переставить порядок

### 3.3 Ограничение доступа
- Только роль `admin`.
- Для остальных ролей раздел не отображается.

---

## 4) Технический подход интеграции (без JSONB)

1. Создать `CatalogService` в `src/lib/catalog-service.js`.
2. Перевести UI формы на загрузку опций из БД (через react-query + кэш).
3. На переходный период оставить fallback на текущие константы.
4. Постепенно заменить валидации `zod enum` на значения из справочников (или проверку по `code`).

---

## 5) Рекомендуемая последовательность внедрения

1. Сначала подключить read-only загрузку справочников в формы (без админки).
2. Затем включить админ-CRUD.
3. После стабилизации удалить хардкод из `constants.js`/компонентов.
4. Добавить аудит изменений справочников (отдельная таблица `catalog_audit_log`).


## 6) Что уже переведено на справочники (MVP implementation)

- `PassportEditor`: статусы проекта читаются из `dict_project_statuses` (с fallback).
- `CompositionEditor`: `parkingType`, `parkingConstruction`, `infraType`, `stage` читаются из справочников.
- `ConstructiveCard`: `foundation`, `walls`, `slabs`, `roof` читаются из справочников.
- `MopEditor`: типы МОП читаются из `dict_mop_types`.
- `ApplicationsDashboard`: выбор источника входящей заявки использует `dict_external_systems`.
- Добавлен отдельный экран админки справочников `CatalogsAdminPanel`.
