package uz.reestrmkd.backendjpa.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.persistence.Tuple;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backendjpa.api.error.ApiErrorException;

import java.time.Instant;
import java.util.*;

@Service
public class WorkflowJpaService {
    @PersistenceContext
    private EntityManager em;

    @Transactional
    public Map<String, Object> completeStep(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        Map<String, Object> app = getApplication(applicationId);
        ensureActorLock(applicationId, actorUserId);

        Object rawStep = body == null ? null : body.get("stepIndex");
        Integer stepIndex = parseIntStrict(rawStep);
        if (stepIndex == null || stepIndex < 0) {
            throw new ApiErrorException(HttpStatus.BAD_REQUEST, "INVALID_STEP_INDEX", "stepIndex must be a non-negative integer");
        }

        int currentStep = toInt(app.get("current_step"));
        if (stepIndex != currentStep) {
            throw new ApiErrorException(
                HttpStatus.CONFLICT,
                "INVALID_STEP_STATE",
                "stepIndex does not match current step",
                Map.of("expectedStepIndex", currentStep, "gotStepIndex", stepIndex)
            );
        }

        int currentStage = toInt(app.get("current_stage"));
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");
        String currentSubstatus = strOr(app.get("workflow_substatus"), "DRAFT");

        int nextStep = currentStep + 1;
        boolean stageBoundary = lastStepByStage(currentStage) == currentStep;
        boolean isLastStepGlobal = nextStep >= 15;

        String nextStatus;
        String nextSubstatus;
        int nextStage = currentStage;
        if (isLastStepGlobal) {
            nextStatus = "COMPLETED";
            nextSubstatus = "DONE";
        } else if (stageBoundary) {
            nextStatus = "IN_PROGRESS";
            nextSubstatus = "REVIEW";
            nextStage = currentStage + 1;
        } else if (nextStep == 13) {
            nextStatus = "IN_PROGRESS";
            nextSubstatus = "INTEGRATION";
        } else {
            nextStatus = "IN_PROGRESS";
            nextSubstatus = "INTEGRATION".equals(currentSubstatus) ? "INTEGRATION" : "DRAFT";
        }

        updateApp(applicationId, nextStep, nextStatus, nextSubstatus, nextStage, Map.of());
        upsertStep(applicationId, stepIndex, true, null);

        String comment = body == null || body.get("comment") == null ? "Complete step " + stepIndex : String.valueOf(body.get("comment"));
        String historyEventId = addHistory(applicationId, "COMPLETE_STEP", currentStatus, nextStatus, actorUserId, comment);
        Map<String, Object> updated = getApplication(applicationId);
        return workflowResponseFromRow(updated, historyEventId);
    }

    @Transactional
    public Map<String, Object> rollbackStep(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        Map<String, Object> app = getApplication(applicationId);
        ensureActorLock(applicationId, actorUserId);

        int currentStep = toInt(app.get("current_step"));
        int currentStage = toInt(app.get("current_stage"));
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");
        String currentSubstatus = strOr(app.get("workflow_substatus"), "DRAFT");

        int nextStep = Math.max(0, currentStep - 1);
        String nextSubstatus = ("REVIEW".equals(currentSubstatus) || "DONE".equals(currentSubstatus)) ? "DRAFT" : currentSubstatus;
        int nextStage = currentStage;
        String nextStatus = "IN_PROGRESS";

        updateApp(applicationId, nextStep, nextStatus, nextSubstatus, nextStage, Map.of());
        upsertStep(applicationId, currentStep, false, null);

        String reason = body == null || body.get("reason") == null ? "Rollback step" : String.valueOf(body.get("reason"));
        String historyEventId = addHistory(applicationId, "ROLLBACK_STEP", currentStatus, nextStatus, actorUserId, reason);
        Map<String, Object> updated = getApplication(applicationId);
        return workflowResponseFromRow(updated, historyEventId);
    }

    @Transactional
    public Map<String, Object> reviewApprove(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        Map<String, Object> app = getApplication(applicationId);

        int currentStep = toInt(app.get("current_step"));
        int currentStage = toInt(app.get("current_stage"));
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");

        String nextStatus = "IN_PROGRESS";
        String nextSubstatus = currentStep == 13 ? "INTEGRATION" : "DRAFT";

        updateApp(applicationId, currentStep, nextStatus, nextSubstatus, currentStage, Map.of());
        int reviewedStage = Math.max(1, currentStage - 1);
        updateStageVerification(applicationId, reviewedStage, true);

        String comment = body == null || body.get("comment") == null ? "Review approved" : String.valueOf(body.get("comment"));
        String historyEventId = addHistory(applicationId, "REVIEW_APPROVE", currentStatus, nextStatus, actorUserId, comment);
        Map<String, Object> updated = getApplication(applicationId);
        return workflowResponseFromRow(updated, historyEventId);
    }

    @Transactional
    public Map<String, Object> reviewReject(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        Map<String, Object> app = getApplication(applicationId);

        int currentStage = toInt(app.get("current_stage"));
        int nextStage = Math.max(1, currentStage - 1);
        int nextStep = lastStepByStage(nextStage);
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");

        updateApp(applicationId, nextStep, "IN_PROGRESS", "REVISION", nextStage, Map.of());
        int reviewedStage = Math.max(1, currentStage - 1);
        updateStageVerification(applicationId, reviewedStage, false);

        String reason = body == null || body.get("reason") == null ? "Review rejected" : String.valueOf(body.get("reason"));
        String historyEventId = addHistory(applicationId, "REVIEW_REJECT", currentStatus, "IN_PROGRESS", actorUserId, reason);
        Map<String, Object> updated = getApplication(applicationId);
        return workflowResponseFromRow(updated, historyEventId);
    }

    @Transactional
    public Map<String, Object> assignTechnician(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        String assignee = body == null || body.get("assigneeUserId") == null ? null : String.valueOf(body.get("assigneeUserId"));
        if (assignee == null || assignee.isBlank()) {
            throw new ApiErrorException(HttpStatus.BAD_REQUEST, "INVALID_PAYLOAD", "assigneeUserId is required");
        }

        Map<String, Object> app = getApplication(applicationId);
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");
        String currentSubstatus = strOr(app.get("workflow_substatus"), "DRAFT");

        execute("update applications set assignee_name = :assignee, updated_at = now() where id = cast(:id as uuid)",
            Map.of("assignee", assignee, "id", applicationId));

        String reason = body == null || body.get("reason") == null ? "Assigned to " + assignee : String.valueOf(body.get("reason"));
        String historyEventId = addHistory(applicationId, "ASSIGN_TECHNICIAN", currentStatus, currentStatus, actorUserId, reason);

        return Map.of("assigneeUserId", assignee, "workflowSubstatus", currentSubstatus, "historyEventId", historyEventId);
    }

    @Transactional
    public Map<String, Object> requestDecline(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        Map<String, Object> app = getApplication(applicationId);
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");
        int currentStep = toInt(app.get("current_step"));
        int currentStage = toInt(app.get("current_stage"));

        String reason = body == null || body.get("reason") == null ? null : String.valueOf(body.get("reason"));
        Integer providedStep = parseIntStrict(body == null ? null : body.get("stepIndex"));
        int declineStep = providedStep == null ? currentStep : providedStep;

        String requestedAt = Instant.now().toString();

        updateApp(applicationId, currentStep, "IN_PROGRESS", "PENDING_DECLINE", currentStage, Map.of(
            "requested_decline_reason", reason,
            "requested_decline_step", declineStep,
            "requested_decline_by", actorUserId,
            "requested_decline_at", requestedAt
        ));

        String historyEventId = addHistory(applicationId, "REQUEST_DECLINE", currentStatus, "IN_PROGRESS", actorUserId,
            reason == null || reason.isBlank() ? "Request decline" : reason);

        return Map.of("workflowSubstatus", "PENDING_DECLINE", "requestedDeclineAt", requestedAt, "historyEventId", historyEventId);
    }

    @Transactional
    public Map<String, Object> decline(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        Map<String, Object> app = getApplication(applicationId);
        int currentStep = toInt(app.get("current_step"));
        int currentStage = toInt(app.get("current_stage"));
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");

        String substatus = switch (actorRole) {
            case "controller" -> "DECLINED_BY_CONTROLLER";
            case "branch_manager" -> "DECLINED_BY_MANAGER";
            case "admin" -> "DECLINED_BY_ADMIN";
            default -> "DECLINED_BY_ADMIN";
        };

        updateApp(applicationId, currentStep, "DECLINED", substatus, currentStage, Map.of());

        String reason = body == null || body.get("reason") == null ? "Declined" : String.valueOf(body.get("reason"));
        String historyEventId = addHistory(applicationId, "DECLINE", currentStatus, "DECLINED", actorUserId, reason);
        Map<String, Object> updated = getApplication(applicationId);
        return workflowResponseFromRow(updated, historyEventId);
    }

    @Transactional
    public Map<String, Object> returnFromDecline(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        Map<String, Object> app = getApplication(applicationId);
        int currentStep = toInt(app.get("current_step"));
        int currentStage = toInt(app.get("current_stage"));
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");

             Map<String, Object> clearedDeclineRequest = new LinkedHashMap<>();
        clearedDeclineRequest.put("requested_decline_reason", null);
        clearedDeclineRequest.put("requested_decline_step", null);
        clearedDeclineRequest.put("requested_decline_by", null);
        clearedDeclineRequest.put("requested_decline_at", null);

        updateApp(applicationId, currentStep, "IN_PROGRESS", "RETURNED_BY_MANAGER", currentStage, clearedDeclineRequest);

        String comment = body == null || body.get("comment") == null ? "Return from decline" : String.valueOf(body.get("comment"));
        String historyEventId = addHistory(applicationId, "RETURN_FROM_DECLINE", currentStatus, "IN_PROGRESS", actorUserId, comment);
        return Map.of("workflowSubstatus", "RETURNED_BY_MANAGER", "historyEventId", historyEventId);
    }

    @Transactional
    public Map<String, Object> restore(String applicationId, Map<String, Object> body, String actorUserId, String actorRole) {
        Map<String, Object> app = getApplication(applicationId);
        int currentStep = toInt(app.get("current_step"));
        int currentStage = toInt(app.get("current_stage"));
        String currentStatus = strOr(app.get("status"), "IN_PROGRESS");

        updateApp(applicationId, currentStep, "IN_PROGRESS", "DRAFT", currentStage, Map.of());

        String comment = body == null || body.get("comment") == null ? "Restore application" : String.valueOf(body.get("comment"));
        String historyEventId = addHistory(applicationId, "RESTORE", currentStatus, "IN_PROGRESS", actorUserId, comment);
        Map<String, Object> updated = getApplication(applicationId);
        return workflowResponseFromRow(updated, historyEventId);
    }

    private Map<String, Object> getApplication(String applicationId) {
        Map<String, Object> app = queryOne("select * from applications where id = cast(:id as uuid)", Map.of("id", applicationId));
        if (app == null) throw new ApiErrorException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Application not found");
        return app;
    }

    private void ensureActorLock(String applicationId, String actorUserId) {
        Map<String, Object> lock = queryOne("select owner_user_id, expires_at from application_locks where application_id = cast(:id as uuid)", Map.of("id", applicationId));
        if (lock == null) {
            throw new ApiErrorException(HttpStatus.LOCKED, "LOCK_REQUIRED", "Active lock owned by current user is required");
        }
        String owner = lock.get("owner_user_id") == null ? null : String.valueOf(lock.get("owner_user_id"));
        Instant expiresAt = parseInstant(lock.get("expires_at"));
        if (!Objects.equals(owner, actorUserId) || expiresAt == null || !expiresAt.isAfter(Instant.now())) {
            throw new ApiErrorException(HttpStatus.LOCKED, "LOCK_REQUIRED", "Active lock owned by current user is required");
        }
    }

    private void updateApp(String applicationId, int step, Object status, Object substatus, int stage, Map<String, Object> extraFields) {
        StringBuilder sql = new StringBuilder("""
            update applications
            set current_step = :step,
                status = :status,
                workflow_substatus = :substatus,
                current_stage = :stage,
                updated_at = now()
            """);
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("step", step);
        params.put("status", status);
        params.put("substatus", substatus);
        params.put("stage", stage);

        for (var entry : extraFields.entrySet()) {
            sql.append(", ").append(entry.getKey()).append(" = :").append(entry.getKey());
            params.put(entry.getKey(), entry.getValue());
        }

        sql.append(" where id = cast(:id as uuid)");
        params.put("id", applicationId);
        execute(sql.toString(), params);
    }

    private void upsertStep(String applicationId, int stepIndex, Boolean isCompleted, Boolean isVerified) {
        StringBuilder insertCols = new StringBuilder("id, application_id, step_index, updated_at");
        StringBuilder insertVals = new StringBuilder(":id, cast(:applicationId as uuid), :stepIndex, now()");
        StringBuilder updateSet = new StringBuilder("updated_at = now()");

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("id", UUID.randomUUID().toString());
        params.put("applicationId", applicationId);
        params.put("stepIndex", stepIndex);

        if (isCompleted != null) {
            insertCols.append(", is_completed");
            insertVals.append(", :isCompleted");
            updateSet.append(", is_completed = excluded.is_completed");
            params.put("isCompleted", isCompleted);
        }
        if (isVerified != null) {
            insertCols.append(", is_verified");
            insertVals.append(", :isVerified");
            updateSet.append(", is_verified = excluded.is_verified");
            params.put("isVerified", isVerified);
        }

        execute("insert into application_steps(" + insertCols + ") values (" + insertVals + ") " +
                "on conflict (application_id, step_index) do update set " + updateSet, params);
    }

    private void updateStageVerification(String applicationId, int stage, boolean isVerified) {
        int start = Math.max(0, lastStepByStage(stage - 1) + 1);
        int end = lastStepByStage(stage);
        for (int i = start; i <= end; i++) {
            upsertStep(applicationId, i, null, isVerified);
        }
    }

    private int lastStepByStage(int stage) {
        return switch (stage) {
            case 1 -> 6;
            case 2 -> 9;
            case 3 -> 12;
            case 4 -> 14;
            default -> 14;
        };
    }

    private String addHistory(String applicationId, String action, String prevStatus, String nextStatus, String userName, String comment) {
        Map<String, Object> row = queryOne("""
            insert into application_history(id, application_id, action, prev_status, next_status, user_name, comment)
            values (cast(:id as uuid), cast(:applicationId as uuid), :action, :prevStatus, :nextStatus, :userName, :comment)
            returning id
            """, Map.of(
            "id", UUID.randomUUID().toString(),
            "applicationId", applicationId,
            "action", action,
            "prevStatus", prevStatus,
            "nextStatus", nextStatus,
            "userName", userName,
            "comment", comment
        ));
        return row == null || row.get("id") == null ? null : String.valueOf(row.get("id"));
    }

    private Map<String, Object> workflowResponseFromRow(Map<String, Object> row, String historyEventId) {
        var response = new LinkedHashMap<String, Object>();
        response.put("applicationStatus", row.get("status"));
        response.put("workflowSubstatus", row.get("workflow_substatus"));
        response.put("currentStep", toInt(row.get("current_step")));
        response.put("currentStage", toInt(row.get("current_stage")));
        response.put("historyEventId", historyEventId);
        return response;
    }

    private Map<String, Object> queryOne(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql, Tuple.class);
        params.forEach(query::setParameter);
        @SuppressWarnings("unchecked")
        List<Tuple> tuples = query.getResultList();
        if (tuples.isEmpty()) return null;
        Map<String, Object> row = new LinkedHashMap<>();
        tuples.get(0).getElements().forEach(e -> row.put(e.getAlias(), tuples.get(0).get(e)));
        return row;
    }

    private int execute(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query.executeUpdate();
    }

    private int toInt(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (NumberFormatException e) { return 0; }
    }

    private Integer parseIntStrict(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String strOr(Object value, String fallback) {
        if (value == null) return fallback;
        String s = String.valueOf(value);
        return s.isBlank() ? fallback : s;
    }

    private Instant parseInstant(Object value) {
        if (value == null) return null;
        try {
            if (value instanceof java.sql.Timestamp ts) return ts.toInstant();
            return Instant.parse(String.valueOf(value));
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
