# Лог миграции backend-java (итерационный)

## Шаг 1
**Сделано:** реализован data-access слой для заявок/шагов/истории (`ApplicationRepository`) и перенесены алгоритмы переходов workflow (`WorkflowTransitions`).

**Дальше:** подключить эти сервисы в реальные endpoint-ы workflow и locks.

## Шаг 2
**Сделано:** `LockController` переведен со stub на рабочий `LockService` с SQL-операциями для `get/acquire/refresh/release`.

**Дальше:** перевести endpoint-ы workflow со stub на транзакционный `WorkflowService`.

## Шаг 3
**Сделано:** `WorkflowController` подключен к `WorkflowService`; реализованы операции `complete-step`, `rollback-step`, `review-approve`, `review-reject`, `request-decline`, `decline`, `return-from-decline`, `restore`.

**Дальше:** реализовать оставшиеся домены (projects/registry/composition/catalogs/versioning/auth) без `NOT_IMPLEMENTED`.

## Шаг 4
**Сделано:** перенесены auth/catalog домены на прямой JDBC:
- `POST /api/v1/auth/login` через `AuthService` + генерация HS256 JWT в `JwtHs256Service.generate`.
- `GET /api/v1/catalogs/:table`, `POST /upsert`, `PUT /:id/active` через `CatalogService`.

**Дальше:** перенос composition + registry endpoint-ов со stub на рабочие SQL-операции.

## Шаг 5
**Сделано:** перенесены composition endpoint-ы на JDBC (`CompositionService`):
- `GET/POST /api/v1/projects/:projectId/buildings`
- `PUT/DELETE /api/v1/buildings/:buildingId`
- `PUT /api/v1/buildings/:buildingId/cadastre`
- `PUT /api/v1/units/:unitId/cadastre`

**Дальше:** перенос registry домена (floors/entrances/units/common-areas/reconcile) и project/versioning endpoint-ов.

## Шаг 6
**Сделано:** частично перенесен registry-домен на JDBC (`RegistryService`):
- Floors: `GET`, `PUT`, `POST reconcile`
- Entrances: `GET`, `POST reconcile`
- Units: `GET`, `POST upsert`, `POST batch-upsert`
- Common areas: `GET`, `POST upsert`, `DELETE`, `POST clear`

**Дальше:** закрыть оставшиеся registry endpoint-ы (`entrance-matrix`, `units/common-areas reconcile`, `explication`, `parking-places/sync`) и перейти к projects/versioning.

## Шаг 7
**Сделано:** закрыты оставшиеся registry endpoint-ы, ранее помеченные как `NOT_IMPLEMENTED`:
- `GET /blocks/:blockId/entrance-matrix`
- `PUT /blocks/:blockId/entrance-matrix/cell`
- `POST /blocks/:blockId/units/reconcile`
- `GET /units/:unitId/explication`
- `POST /floors/:floorId/parking-places/sync`
- `POST /blocks/:blockId/common-areas/reconcile`

**Дальше:** перенос project/versioning endpoint-ов и удаление `NOT_IMPLEMENTED` из этих доменов.

## Шаг 8
**Сделано:** перенесены project/versioning endpoint-ы со stub на сервисы `ProjectService` и `VersioningService`.
- В `ProjectController` все маршруты теперь обрабатываются реальным сервисом без `NOT_IMPLEMENTED`.
- В `VersioningController` все маршруты теперь обрабатываются через JDBC-сервис и policy-проверки.

**Дальше:** стабилизация SQL-контрактов на реальных данных и финальная валидация полной route-паритетности.

## Шаг 9
**Сделано:** рядом добавлен второй вариант backend-а `apps/backend-java-jpa`, где DB-слой реализован через Hibernate JPA Repository вместо `JdbcTemplate`.

**Дальше:** при необходимости расширить JPA-вариант до полного route-паритета аналогично `apps/backend-java`.

## Шаг 10
**Сделано:** JPA-вариант `apps/backend-java-jpa` расширен до полного route-surface и дополнен Lombok.

**Дальше:** при необходимости выполнить углубленную контрактную сверку payload/SQL-поведения каждого endpoint с `apps/backend-java`.
