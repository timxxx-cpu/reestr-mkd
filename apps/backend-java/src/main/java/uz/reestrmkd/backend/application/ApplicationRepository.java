package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import uz.reestrmkd.backend.common.ApiException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@Repository
public class ApplicationRepository {
    private final JdbcTemplate jdbc;

    public ApplicationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public AppRow getApplication(String applicationId) {
        List<AppRow> rows = jdbc.query(
            "select id, status, workflow_substatus, current_step, current_stage from applications where id = ?",
            (rs, n) -> mapAppRow(rs), applicationId
        );
        if (rows.isEmpty()) throw new ApiException(NOT_FOUND, "NOT_FOUND", "Application not found");
        return rows.get(0);
    }

    public void ensureActorLock(String applicationId, String actorUserId) {
        var rows = jdbc.query(
            "select owner_user_id, expires_at from application_locks where application_id = ?",
            (rs, n) -> Map.of("owner", rs.getString("owner_user_id"), "exp", rs.getTimestamp("expires_at").toInstant()),
            applicationId
        );
        if (rows.isEmpty()) throw new ApiException(LOCKED, "LOCK_REQUIRED", "Active lock owned by current user is required");
        var row = rows.get(0);
        boolean ok = actorUserId.equals(String.valueOf(row.get("owner"))) && ((Instant) row.get("exp")).isAfter(Instant.now());
        if (!ok) throw new ApiException(LOCKED, "LOCK_REQUIRED", "Active lock owned by current user is required");
    }

    public AppRow updateApplicationState(String applicationId, WorkflowTransitions.Transition t) {
        int updated = jdbc.update(
            "update applications set status = ?, workflow_substatus = ?, current_step = ?, current_stage = ?, updated_at = now() where id = ?",
            t.nextStatus(), t.nextSubstatus(), t.nextStepIndex(), t.nextStage(), applicationId
        );
        if (updated == 0) throw new ApiException(NOT_FOUND, "NOT_FOUND", "Application not found");
        return getApplication(applicationId);
    }

    public long addHistory(String applicationId, String action, String prevStatus, String nextStatus, String userName, String comment) {
        return jdbc.queryForObject(
            "insert into application_history(application_id, action, prev_status, next_status, user_name, comment) values (?, ?, ?, ?, ?, ?) returning id",
            Long.class, applicationId, action, prevStatus, nextStatus, userName, comment
        );
    }

    public void updateStepCompletion(String applicationId, int stepIndex, boolean isCompleted) {
        jdbc.update(
            "insert into application_steps(application_id, step_index, is_completed) values (?, ?, ?) " +
                "on conflict (application_id, step_index) do update set is_completed = excluded.is_completed",
            applicationId, stepIndex, isCompleted
        );
    }

    public void updateStageVerification(String applicationId, int stage, boolean isVerified) {
        var range = WorkflowTransitions.getStageStepRange(stage);
        if (range == null) throw new ApiException(BAD_REQUEST, "INVALID_STAGE", "Cannot resolve step range for stage " + stage);
        for (int i = range.start(); i <= range.end(); i++) {
            jdbc.update(
                "insert into application_steps(application_id, step_index, is_verified) values (?, ?, ?) " +
                    "on conflict (application_id, step_index) do update set is_verified = excluded.is_verified",
                applicationId, i, isVerified
            );
        }
    }

    private AppRow mapAppRow(ResultSet rs) throws SQLException {
        return AppRow.normalize(
            rs.getString("id"),
            rs.getString("status"),
            rs.getString("workflow_substatus"),
            rs.getObject("current_step", Integer.class),
            rs.getObject("current_stage", Integer.class)
        );
    }
}
