# Frontend ↔ backend-java-jpa Contract Audit

## Scope
Audit of unimplemented or partially implemented API contracts used by frontend (`src/lib/bff-client.js`) against Java JPA backend controllers.

## Critical gaps (P0)

### 1) `ProjectController` has many stubbed endpoints
Several endpoints still return `ResponseEntity.ok(null)` or `noContent()` and are not contract-complete for frontend flows.

Examples include:
- `POST /api/v1/projects/buildings`
- `GET /api/v1/projects/{id}/full-registry`
- `GET /api/v1/projects/{id}/tep-summary`
- `GET /api/v1/projects/{id}/context`
- `GET /api/v1/projects/{id}/context-registry-details`
- `GET /api/v1/projects/{id}/validation/step`
- `PUT /api/v1/projects/{id}/context-meta/save`
- `PUT /api/v1/projects/{id}/step-block-statuses/save`
- `PUT /api/v1/projects/{id}/context-building-details/save`
- `POST /api/v1/projects/{id}/buildings/{buildingId}/geometry/select`
- `POST /api/v1/projects/{id}/land-plots/{landPlotId}/select`
- `DELETE /api/v1/projects/{id}/land-plots/{landPlotId}`
- `GET /api/v1/projects/{id}/passport`
- `POST /api/v1/projects/{id}/participants/upsert`
- `POST /api/v1/projects/{id}/documents/upsert`
- `DELETE /api/v1/projects/{id}`
- `GET /api/v1/projects/{id}/basements`
- `GET /api/v1/projects/{id}/parking-counts`
- `GET /api/v1/projects/{id}/application-id`

### 2) `RegistryController` composition/registry endpoints still stubbed
The following endpoints contain placeholder responses and do not provide required frontend data:
- block extensions (`GET/POST/PUT/DELETE`)
- floors/entrances/entrance-matrix listing
- units list/upsert
- floor update

### 3) Workflow contract mismatch
Frontend expects workflow actions that are absent in `WorkflowController`:
- `POST /api/v1/workflow/review-reject`
- `POST /api/v1/workflow/assign-technician`
- `POST /api/v1/workflow/request-decline`
- `POST /api/v1/workflow/return-from-decline`
- `POST /api/v1/workflow/restore`

## High-priority gaps (P1)

### 4) Dashboard count semantics partially implemented
Frontend dashboard expects split counters (`work`, `review`, `integration`, `pendingDecline`, `declined`, `completed`, etc.). Current backend aggregation is primarily status-based and needs substatus-aware aggregation.

### 5) `CompositionController` batch operations are placeholders
Endpoints such as:
- `POST /api/v1/blocks/{id}/batch-upsert`
- `POST /api/v1/blocks/{id}/preview`
- `POST /api/v1/blocks/{id}/floors/batch`

currently return no-content placeholders.

## Suggested implementation plan

1. **P0:** Fully implement stubbed `ProjectController` endpoints and remove null/no-content placeholders.
2. **P0:** Implement `RegistryController`/`CompositionController` response contracts used by frontend composition screens.
3. **P0:** Add missing workflow endpoints and align request/response DTOs with frontend expectations.
4. **P1:** Extend dashboard counting to include workflow substatus aggregation.
5. **P1/P2:** Add API contract tests for top frontend-driven flows.

## Notes
This document is based on static code audit of current branch and is intended as execution backlog input.
