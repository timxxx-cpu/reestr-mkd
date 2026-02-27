# reestr-mkd backend-java (Spring Boot 21 + Maven)

Новый backend размещён рядом с `apps/backend` для поэтапной передачи Java-команде.

## Стек
- Java 21
- Spring Boot 3
- Maven
- Spring Web / Validation / Data JPA / Security
- PostgreSQL (прямое подключение)

## Запуск
```bash
cd apps/backend-java
mvn spring-boot:run
```

## Переменные окружения
- `PORT` (default `8788`)
- `HOST` (default `0.0.0.0`)
- `DB_URL` (default `jdbc:postgresql://localhost:5432/reestr_mkd`)
- `DB_USER`
- `DB_PASSWORD`
- `AUTH_MODE` (`dev|jwt`, default `dev`)
- `JWT_SECRET`
- `RUNTIME_ENV` / `APP_ENV` / `NODE_ENV`
- `CORS_ORIGIN`

## Архитектура
- `api/*Controller` — endpoint surface c 1:1 маршрутами от текущего BFF.
- `security/*` — auth-context, JWT HS256, policy matrix.
- `common/*` — unified error contract.
- `application/*` — idempotency store + сервисный слой переноса.

## Проверка PostgreSQL
- `GET /api/v1/ops/db-ping` -> выполняет `select 1` через JdbcTemplate.

## Endpoint parity map
Все endpoint-маршруты из `apps/backend/README.md` заведены в контроллеры Spring (`api/*`).

## Важно
Текущая итерация закладывает полную карту endpoint-ов и инфраструктурный каркас (auth/policy/error-contract/direct PostgreSQL).
Бизнес-логика переноса по каждому route находится в процессе переноса в `BackendPortingService` и доменные сервисы.
