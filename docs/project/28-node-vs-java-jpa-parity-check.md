# Проверка паритета Node.js backend ↔ Java JPA backend

Дата обновления: 2026-03-02.

## Что изменено после ревью

Предыдущая версия проверяла только `method + path` (route-surface).
По комментариям добавлена **функциональная дифференциальная проверка** между двумя runtime-вариантами:

- Node.js backend (`apps/backend`) — source of truth;
- Java JPA backend (`apps/backend-java-jpa`).

Проверка теперь ориентирована на 4 обязательные зоны parity:

1. валидация payload;
2. business-логика workflow переходов;
3. error-контракты и status codes;
4. побочные эффекты в БД (через последующие read endpoint-ы).

## Инструменты проверки

### 1) Surface parity (method + path)

```bash
npm run check:backend-jpa-parity
```

Скрипт: `scripts/check-backend-jpa-parity.mjs`.

### 2) Functional parity (black-box differential)

```bash
NODE_BACKEND_URL=http://127.0.0.1:8788 \
JAVA_JPA_BACKEND_URL=http://127.0.0.1:8789 \
PARITY_SCENARIOS=tests/parity/backend-functional-parity.scenarios.json \
npm run check:backend-jpa-functional-parity
```

Скрипт: `scripts/check-backend-jpa-functional-parity.mjs`.

Он:
- прогоняет одинаковые HTTP-сценарии на обоих backend;
- сравнивает status и body;
- поддерживает исключение нестабильных полей (`ignorePaths`);
- поддерживает цепочки шагов для проверки side-effects после mutating endpoint-ов.


### 3) Tooling self-tests (без реальных backend)

```bash
npm run test:backend-jpa-parity-tooling
```

Проверяет сам parity-checker на локальных mock HTTP серверах:
- green-case (одинаковые ответы) должен проходить;
- red-case (разные status/body) должен падать.

### 4) Полный e2e (автоподъем обоих runtime)

Если JDBC-контур для Java JPA доступен локально, можно выполнить полный прогон одной командой:

```bash
DB_URL=jdbc:postgresql://localhost:5432/reestr_mkd \
DB_USER=postgres \
DB_PASSWORD=postgres \
npm run run:backend-jpa-e2e-parity
```

Скрипт `scripts/run-backend-jpa-e2e-parity.mjs`:
- поднимает Node backend (`apps/backend`) и Java JPA backend (`apps/backend-java-jpa`);
- ждёт readiness (`/health` и `/api/v1/ops/ping`);
- запускает `check:backend-jpa-functional-parity`;
- завершает оба процесса.

## Файл сценариев

Сценарии лежат в `tests/parity/backend-functional-parity.scenarios.json` и группируются по целям:

- `error-contracts`;
- `payload-validation`;
- `workflow-and-db-side-effects`.

## Как интерпретировать результат

Требование «100% parity» считается выполненным, когда одновременно:

- `check:backend-jpa-parity` → без missing/extra routes;
- `check:backend-jpa-functional-parity` → 0 mismatch по всем сценариям функциональной матрицы.

Если появляется хотя бы один mismatch, parity не достигнут и нужен фикс в Java JPA runtime.
