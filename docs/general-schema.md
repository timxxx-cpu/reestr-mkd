# General schema (`general`) for auth and RBAC

This document describes the `general` schema used by the project for authentication and role-based access.

## Purpose

- Store platform users (`general.users`) used by `/api/v1/auth/login`.
- Store role dictionary (`general.user_role`) where **`name_uk` is the canonical system role key**.
- Link users to roles (`general.user_attached_roles`).
- Store action/resource dictionaries for RBAC (`app_actions`, `resources`, etc.).

## Canonical role key

For this project, role key must be read from:

- `general.user_role.name_uk`

Expected values:

- `admin`
- `branch_manager`
- `technician`
- `controller`

These values must match the backend/frontend policy matrices.

## Main auth tables

### `general.users`

- `id` (PK)
- `login` (unique, used as username)
- `password` (plain text currently, migrate to hash later)
- `full_name` (display name)
- `status` (active flag)
- `user_type_id` -> `general.user_types.id`

### `general.user_role`

- `id` (PK)
- `name_uk` (**system role key**)
- `name_ru`, `name_uz`, `name_en` (localized labels)
- `status`

### `general.user_attached_roles`

- `id` (PK)
- `user_id` -> `general.users.id`
- `role_id` -> `general.user_role.id`
- `status` (active assignment)

## Login query logic used by project

1. Find active user in `general.users` by:
   - `login`
   - `password`
   - `status = true`
2. Find active role assignment in `general.user_attached_roles` by user id and `status = true`.
3. Read role key from `general.user_role.name_uk`.
4. Issue JWT with payload fields:
   - `sub = users.id`
   - `role = user_role.name_uk`
   - `name = users.full_name` (fallback to `login`)

## Recommended data rules

- Keep `users.login` unique and immutable for integration stability.
- Keep `user_role.name_uk` lowercase snake_case and stable.
- Prefer deactivation (`status = false`) instead of hard deletion.
- Add password hashing migration (bcrypt/argon2) as next security step.

## Seed baseline roles

```sql
insert into general.user_role(name_uk, name_ru, name_uz, name_en)
values
  ('admin', 'Администратор', 'Administrator', 'Administrator'),
  ('branch_manager', 'Начальник филиала', 'Filial rahbari', 'Branch manager'),
  ('technician', 'Техник-инвентаризатор', 'Texnik-inventarizator', 'Technician'),
  ('controller', 'Бригадир-контролер', 'Nazorat brigadiri', 'Controller')
on conflict (name_uk) do nothing;
```
