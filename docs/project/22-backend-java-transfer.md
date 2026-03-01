# Передача backend на Java 21 (Spring Boot + Maven)

Добавлен новый модуль: `apps/backend-java`.

## Что включено
- Spring Boot приложение на Java 21 и Maven.
- Прямое подключение к PostgreSQL (`spring.datasource.*`).
- Полная карта endpoint-ов (1:1 по маршрутам текущего BFF) в Java контроллерах.
- Базовая инфраструктура: auth-mode (`dev|jwt`), HS256 JWT verify, RBAC policy matrix, unified error-contract, request-id headers, in-memory idempotency.

## Цель размещения
Модуль добавлен рядом с действующим `apps/backend` для изучения и последующего завершения переноса командой Java-разработки без переключения runtime текущего проекта.


## Важно для карты всех ЖК
- Endpoint `GET /api/v1/projects/map-overview` должен возвращать данные зданий не только с `geometry`, но и с номером дома для подписи внутри полигона: поддерживаются ключи `houseNumber` (предпочтительно) или `house_number` (legacy).
- Для подписи внутри границ ЖК требуется корректное поле `name` у проекта (используется как текстовая метка).
- Для карточек по клику backend map-overview также должен отдавать проектные поля `address/status/totalBuildings/buildingTypeStats[]` и по зданию `category/blocksCount/floorsMax/apartmentsCount/address`.

- Для редактора блоков backend должен поддерживать `blockGeometry` (Polygon/MultiPolygon) и проверку, что геометрия блока полностью внутри геометрии здания при сохранении.

- Для 3D-режима общей карты endpoint `GET /api/v1/projects/map-overview` должен возвращать `buildings[].blocks[]` с `geometry` и `floorsCount`; в UI 3D рендерится только выбранный в левой панели ЖК.
