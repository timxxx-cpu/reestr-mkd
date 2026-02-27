# Передача backend на Java 21 (Spring Boot + Maven)

Добавлен новый модуль: `apps/backend-java`.

## Что включено
- Spring Boot приложение на Java 21 и Maven.
- Прямое подключение к PostgreSQL (`spring.datasource.*`).
- Полная карта endpoint-ов (1:1 по маршрутам текущего BFF) в Java контроллерах.
- Базовая инфраструктура: auth-mode (`dev|jwt`), HS256 JWT verify, RBAC policy matrix, unified error-contract, request-id headers, in-memory idempotency.

## Цель размещения
Модуль добавлен рядом с действующим `apps/backend` для изучения и последующего завершения переноса командой Java-разработки без переключения runtime текущего проекта.
