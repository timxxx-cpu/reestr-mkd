package uz.reestrmkd.backendjpa.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.persistence.Tuple;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
public class WorkflowJpaService {
    @PersistenceContext
    private EntityManager em;

    @Transactional
    public Map<String, Object> completeStep(String applicationId, Map<String, Object> body) {
        Map<String, Object> app = getApplication(applicationId);
        int stepIndex = toInt(body == null ? null : body.get("stepIndex"));
        int currentStep = toInt(app.get("current_step"));
        int currentStage = toInt(app.get("current_stage"));

        if (stepIndex != currentStep) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "stepIndex does not match current step");
        }

        int nextStep = currentStep + 1;
        int nextStage = currentStage + (nextStep % 3 == 0 ? 1 : 0);

        updateApp(applicationId, nextStep, app.get("status"), app.get("workflow_substatus"), nextStage);
        upsertStep(applicationId, stepIndex, true, false);

        return workflowResponse(applicationId, nextStep, String.valueOf(app.get("status")), String.valueOf(app.get("workflow_substatus")), nextStage);
    }

    @Transactional
    public Map<String, Object> rollbackStep(String applicationId, Map<String, Object> body) {
        Map<String, Object> app = getApplication(applicationId);
        int currentStep = toInt(app.get("current_step"));
        int currentStage = toInt(app.get("current_stage"));
        int nextStep = Math.max(0, currentStep - 1);
        int nextStage = Math.max(1, currentStage - (currentStep % 3 == 0 ? 1 : 0));

        updateApp(applicationId, nextStep, app.get("status"), app.get("workflow_substatus"), nextStage);
        upsertStep(applicationId, currentStep, false, false);

        return workflowResponse(applicationId, nextStep, String.valueOf(app.get("status")), String.valueOf(app.get("workflow_substatus")), nextStage);
    }

    @Transactional
    public Map<String, Object> reviewApprove(String applicationId, Map<String, Object> body) {
        Map<String, Object> app = getApplication(applicationId);
        int stage = Math.max(1, toInt(app.get("current_stage")) - 1);
        updateStageVerification(applicationId, stage, true);
        return workflowResponseFromRow(app);
    }

    @Transactional
    public Map<String, Object> reviewReject(String applicationId, Map<String, Object> body) {
        Map<String, Object> app = getApplication(applicationId);
        int stage = Math.max(1, toInt(app.get("current_stage")) - 1);
        updateStageVerification(applicationId, stage, false);
        updateApp(applicationId, toInt(app.get("current_step")), app.get("status"), "REVISION", toInt(app.get("current_stage")));
        return workflowResponse(applicationId, toInt(app.get("current_step")), String.valueOf(app.get("status")), "REVISION", toInt(app.get("current_stage")));
    }

    @Transactional
    public Map<String, Object> assignTechnician(String applicationId, Map<String, Object> body) {
        String assignee = body == null || body.get("assigneeUserId") == null ? null : String.valueOf(body.get("assigneeUserId"));
        if (assignee == null || assignee.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assigneeUserId is required");
        }
        execute("update applications set assignee_name = :assignee, updated_at = now() where id = :id", Map.of("assignee", assignee, "id", applicationId));
        Map<String, Object> app = getApplication(applicationId);
        return Map.of("assigneeUserId", assignee, "workflowSubstatus", app.get("workflow_substatus"));
    }

    @Transactional
    public Map<String, Object> requestDecline(String applicationId, Map<String, Object> body) {
        Map<String, Object> app = getApplication(applicationId);
        updateApp(applicationId, toInt(app.get("current_step")), "IN_PROGRESS", "PENDING_DECLINE", toInt(app.get("current_stage")));
        return Map.of("workflowSubstatus", "PENDING_DECLINE");
    }

    @Transactional
    public Map<String, Object> decline(String applicationId, Map<String, Object> body) {
        Map<String, Object> app = getApplication(applicationId);
        updateApp(applicationId, toInt(app.get("current_step")), "DECLINED", "DECLINED_BY_ADMIN", toInt(app.get("current_stage")));
        return workflowResponse(applicationId, toInt(app.get("current_step")), "DECLINED", "DECLINED_BY_ADMIN", toInt(app.get("current_stage")));
    }

    @Transactional
    public Map<String, Object> returnFromDecline(String applicationId, Map<String, Object> body) {
        Map<String, Object> app = getApplication(applicationId);
        updateApp(applicationId, toInt(app.get("current_step")), "IN_PROGRESS", "RETURNED_BY_MANAGER", toInt(app.get("current_stage")));
        return Map.of("workflowSubstatus", "RETURNED_BY_MANAGER");
    }

    @Transactional
    public Map<String, Object> restore(String applicationId, Map<String, Object> body) {
        Map<String, Object> app = getApplication(applicationId);
        updateApp(applicationId, toInt(app.get("current_step")), "IN_PROGRESS", "DRAFT", toInt(app.get("current_stage")));
        return workflowResponse(applicationId, toInt(app.get("current_step")), "IN_PROGRESS", "DRAFT", toInt(app.get("current_stage")));
    }

    private Map<String, Object> getApplication(String applicationId) {
        Map<String, Object> app = queryOne("select * from applications where id = :id", Map.of("id", applicationId));
        if (app == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found");
        return app;
    }

    private void updateApp(String applicationId, int step, Object status, Object substatus, int stage) {
        execute("""
            update applications
            set current_step = :step,
                status = :status,
                workflow_substatus = :substatus,
                current_stage = :stage,
                updated_at = now()
            where id = :id
            """, Map.of("step", step, "status", status, "substatus", substatus, "stage", stage, "id", applicationId));
    }

    private void upsertStep(String applicationId, int stepIndex, boolean isCompleted, boolean isVerified) {
        execute("""
            insert into application_steps(id, application_id, step_index, is_completed, is_verified, updated_at)
            values (:id, :applicationId, :stepIndex, :isCompleted, :isVerified, now())
            on conflict (application_id, step_index) do update
            set is_completed = excluded.is_completed,
                is_verified = excluded.is_verified,
                updated_at = now()
            """, Map.of(
            "id", UUID.randomUUID().toString(),
            "applicationId", applicationId,
            "stepIndex", stepIndex,
            "isCompleted", isCompleted,
            "isVerified", isVerified
        ));
    }

    private void updateStageVerification(String applicationId, int stage, boolean isVerified) {
        int start = (stage - 1) * 3;
        int end = start + 2;
        for (int i = start; i <= end; i++) {
            upsertStep(applicationId, i, false, isVerified);
        }
    }

    private Map<String, Object> workflowResponseFromRow(Map<String, Object> row) {
        return workflowResponse(
            String.valueOf(row.get("id")),
            toInt(row.get("current_step")),
            String.valueOf(row.get("status")),
            String.valueOf(row.get("workflow_substatus")),
            toInt(row.get("current_stage"))
        );
    }

    private Map<String, Object> workflowResponse(String applicationId, int currentStep, String status, String substatus, int stage) {
        return Map.of(
            "applicationId", applicationId,
            "applicationStatus", status,
            "workflowSubstatus", substatus,
            "currentStep", currentStep,
            "currentStage", stage
        );
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
}
