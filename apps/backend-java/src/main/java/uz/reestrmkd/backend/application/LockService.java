package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.common.ApiException;

import java.time.Instant;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@Service
public class LockService {
    private final JdbcTemplate jdbc;

    public LockService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> get(String applicationId) {
        var rows = jdbc.query("select owner_user_id, owner_role, expires_at from application_locks where application_id = ?",
            (rs, n) -> Map.of(
                "ownerUserId", rs.getString("owner_user_id"),
                "ownerRole", rs.getString("owner_role"),
                "expiresAt", rs.getTimestamp("expires_at").toInstant().toString()
            ), applicationId);
        if (rows.isEmpty()) return Map.of("locked", false, "ownerUserId", null, "ownerRole", null, "expiresAt", null);
        var row = rows.get(0);
        return Map.of("locked", true, "ownerUserId", row.get("ownerUserId"), "ownerRole", row.get("ownerRole"), "expiresAt", row.get("expiresAt"));
    }

    @Transactional
    public Map<String, Object> acquire(String applicationId, String userId, String role, Integer ttlSecondsRaw) {
        int ttl = Math.max(60, ttlSecondsRaw == null ? 1200 : ttlSecondsRaw);
        ensureApplicationExists(applicationId);
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(ttl);

        var rows = jdbc.query("select owner_user_id, expires_at from application_locks where application_id = ? for update",
            (rs, n) -> Map.of("owner", rs.getString("owner_user_id"), "exp", rs.getTimestamp("expires_at").toInstant()), applicationId);

        if (rows.isEmpty()) {
            jdbc.update("insert into application_locks(application_id, owner_user_id, owner_role, expires_at) values (?,?,?,?)",
                applicationId, userId, role, java.sql.Timestamp.from(exp));
            return Map.of("ok", true, "reason", "LOCK_ACQUIRED", "message", "Lock acquired", "expiresAt", exp.toString());
        }

        var row = rows.get(0);
        Instant currentExp = (Instant) row.get("exp");
        String owner = String.valueOf(row.get("owner"));
        if (currentExp.isAfter(now) && !userId.equals(owner)) {
            throw new ApiException(CONFLICT, "LOCKED", "Application is locked by another user");
        }

        jdbc.update("update application_locks set owner_user_id=?, owner_role=?, expires_at=? where application_id=?",
            userId, role, java.sql.Timestamp.from(exp), applicationId);
        return Map.of("ok", true, "reason", "LOCK_ACQUIRED", "message", "Lock acquired", "expiresAt", exp.toString());
    }

    @Transactional
    public Map<String, Object> refresh(String applicationId, String userId, Integer ttlSecondsRaw) {
        int ttl = Math.max(60, ttlSecondsRaw == null ? 1200 : ttlSecondsRaw);
        Instant exp = Instant.now().plusSeconds(ttl);
        int updated = jdbc.update(
            "update application_locks set expires_at=? where application_id=? and owner_user_id=?",
            java.sql.Timestamp.from(exp), applicationId, userId
        );
        if (updated == 0) throw new ApiException(CONFLICT, "OWNER_MISMATCH", "Lock owner mismatch or lock not found");
        return Map.of("ok", true, "reason", "LOCK_REFRESHED", "message", "Lock refreshed", "expiresAt", exp.toString());
    }

    @Transactional
    public Map<String, Object> release(String applicationId, String userId) {
        int updated = jdbc.update("delete from application_locks where application_id=? and owner_user_id=?", applicationId, userId);
        if (updated == 0) throw new ApiException(CONFLICT, "OWNER_MISMATCH", "Lock owner mismatch or lock not found");
        return Map.of("ok", true, "reason", "LOCK_RELEASED", "message", "Lock released");
    }

    private void ensureApplicationExists(String applicationId) {
        Integer count = jdbc.queryForObject("select count(1) from applications where id = ?", Integer.class, applicationId);
        if (count == null || count == 0) throw new ApiException(NOT_FOUND, "NOT_FOUND", "Application not found");
    }
}
