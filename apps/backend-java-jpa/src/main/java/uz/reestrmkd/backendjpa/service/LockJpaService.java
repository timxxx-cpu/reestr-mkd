package uz.reestrmkd.backendjpa.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestrmkd.backendjpa.api.error.ApiErrorException;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LockJpaService {

    private final NamedParameterJdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public Map<String, Object> get(String applicationId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select owner_user_id, owner_role, expires_at 
            from application_locks 
            where application_id = cast(:appId as uuid)
            """, Map.of("appId", applicationId));
            
        if (rows.isEmpty()) {
         Map<String, Object> empty = new java.util.LinkedHashMap<>();
            empty.put("locked", false);
            empty.put("ownerUserId", null);
            empty.put("ownerRole", null);
            empty.put("expiresAt", null);
            return empty;
        }

        Map<String, Object> row = rows.get(0);
        Object expiresAt = formatApiTimestamp(row.get("expires_at"));
        boolean locked = expiresAt != null;

        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("locked", locked);
        out.put("ownerUserId", locked ? row.get("owner_user_id") : null);
        out.put("ownerRole", locked ? row.get("owner_role") : null);
        out.put("expiresAt", expiresAt);
        return out;
    }

    @Transactional
    public Map<String, Object> acquire(String applicationId, String userId, String role, Integer ttlSecondsRaw) {
        int ttl = Math.max(60, ttlSecondsRaw == null ? 1200 : ttlSecondsRaw);

        // Вызываем надежную функцию БД, которая внутри сама делает ON CONFLICT и пишет аудит
        List<Map<String, Object>> result = jdbc.queryForList("""
            select ok, reason, message, expires_at 
            from acquire_application_lock(cast(:appId as uuid), :userId, :role, :ttl)
            """, Map.of("appId", applicationId, "userId", userId, "role", role, "ttl", ttl));

        if (result.isEmpty()) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "RPC failed");
        
        Map<String, Object> row = result.get(0);
        if (!Boolean.TRUE.equals(row.get("ok"))) {
            throw mapLockError(row);
        }
        
        return Map.of(
            "ok", true, 
            "reason", row.get("reason"), 
            "message", row.get("message"), 
            "expiresAt", formatApiTimestamp(row.get("expires_at"))
        );
    }

    @Transactional
    public Map<String, Object> refresh(String applicationId, String userId, Integer ttlSecondsRaw) {
        int ttl = Math.max(60, ttlSecondsRaw == null ? 1200 : ttlSecondsRaw);
        
        List<Map<String, Object>> result = jdbc.queryForList("""
            select ok, reason, message, expires_at 
            from refresh_application_lock(cast(:appId as uuid), :userId, :ttl)
            """, Map.of("appId", applicationId, "userId", userId, "ttl", ttl));

        if (result.isEmpty()) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "RPC failed");
        
        Map<String, Object> row = result.get(0);
        if (!Boolean.TRUE.equals(row.get("ok"))) {
            throw mapLockError(row);
        }
        
        return Map.of(
            "ok", true, 
            "reason", row.get("reason"), 
            "message", row.get("message"), 
            "expiresAt", formatApiTimestamp(row.get("expires_at"))
        );
    }

    @Transactional
    public Map<String, Object> release(String applicationId, String userId) {
        List<Map<String, Object>> result = jdbc.queryForList("""
            select ok, reason, message 
            from release_application_lock(cast(:appId as uuid), :userId)
            """, Map.of("appId", applicationId, "userId", userId));

        if (result.isEmpty()) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "RPC failed");
        
        Map<String, Object> row = result.get(0);
        if (!Boolean.TRUE.equals(row.get("ok"))) {
            throw mapLockError(row);
        }
        
        return Map.of("ok", true, "reason", row.get("reason"), "message", row.get("message"));
    }

    
    private String formatApiTimestamp(Object value) {
        if (value == null) return null;
        if (value instanceof java.time.Instant instant) return instant.toString().replace("Z", "+00:00");
        if (value instanceof java.time.OffsetDateTime odt) return odt.toInstant().toString().replace("Z", "+00:00");
        if (value instanceof java.time.LocalDateTime ldt) return ldt.atZone(java.time.ZoneId.systemDefault()).toInstant().toString().replace("Z", "+00:00");
        if (value instanceof java.sql.Timestamp ts) return ts.toInstant().toString().replace("Z", "+00:00");
        String s = String.valueOf(value);
        if (s.contains(" ")) s = s.replace(" ", "T");
        if (s.endsWith("Z")) s = s.substring(0, s.length() - 1) + "+00:00";
        return s;
    }

    private ApiErrorException mapLockError(Map<String, Object> row) {
        String reason = row.get("reason") == null ? "LOCK_CONFLICT" : String.valueOf(row.get("reason")).toUpperCase();
        String message = row.get("message") == null ? "Lock operation failed" : String.valueOf(row.get("message"));
        return switch (reason) {
            case "NOT_FOUND" -> new ApiErrorException(HttpStatus.NOT_FOUND, "NOT_FOUND", message, row);
            case "LOCKED" -> new ApiErrorException(HttpStatus.CONFLICT, "LOCKED", message, row);
            case "ASSIGNEE_MISMATCH" -> new ApiErrorException(HttpStatus.FORBIDDEN, "ASSIGNEE_MISMATCH", message, row);
            case "OWNER_MISMATCH" -> new ApiErrorException(HttpStatus.CONFLICT, "OWNER_MISMATCH", message, row);
            default -> new ApiErrorException(HttpStatus.CONFLICT, reason, message, row);
        };
    }

}