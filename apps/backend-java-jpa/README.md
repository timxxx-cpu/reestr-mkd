# backend-java-jpa

Полный альтернативный вариант backend рядом с `apps/backend-java`, где доступ к БД реализован через **Hibernate JPA Repository** (без `JdbcTemplate`).

## Что сделано
- Добавлен отдельный модуль `apps/backend-java-jpa`.
- Подключен Lombok.
- Добавлены JPA entity + repository слои.
- Расширен route surface до 100% покрытия endpoint-ов текущего backend-контракта.

## Запуск
```bash
cd apps/backend-java-jpa
mvn spring-boot:run
```

## Переменные
- `DB_URL`, `DB_USER`, `DB_PASSWORD`
- `PORT` (default `8789`)
- `JWT_SECRET`

## Архитектура
- `domain/*` — JPA entities
- `repo/*` — Spring Data JPA repositories
- `service/*` — application services (auth/project/versioning/jpa-facade)
- `api/*` — контроллеры полного API surface
