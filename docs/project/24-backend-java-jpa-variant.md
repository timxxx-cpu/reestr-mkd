# Вариант backend на Hibernate JPA Repository

Добавлен модуль `apps/backend-java-jpa` как альтернатива `apps/backend-java`.

## Текущее состояние
- DB-access через Spring Data JPA repositories.
- Подключен Lombok.
- Route-surface расширен до полного покрытия endpoint-ов backend-контракта.


## Важно для карты всех ЖК
- Endpoint `GET /api/v1/projects/map-overview` должен возвращать данные зданий не только с `geometry`, но и с номером дома для подписи внутри полигона: поддерживаются ключи `houseNumber` (предпочтительно) или `house_number` (legacy).
- Для подписи внутри границ ЖК требуется корректное поле `name` у проекта (используется как текстовая метка).
- Для карточек по клику backend map-overview также должен отдавать проектные поля `address/status/totalBuildings/buildingTypeStats[]` и по зданию `category/blocksCount/floorsMax/apartmentsCount/address`.

- Для редактора блоков backend должен поддерживать `blockGeometry` (Polygon/MultiPolygon) и проверку, что геометрия блока полностью внутри геометрии здания при сохранении.

- Для 3D-режима общей карты endpoint `GET /api/v1/projects/map-overview` должен возвращать `buildings[].blocks[]` с `geometry` и `floorsCount`; в UI 3D рендерится только выбранный в левой панели ЖК.
