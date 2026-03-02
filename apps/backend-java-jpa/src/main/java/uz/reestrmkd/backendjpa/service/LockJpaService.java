package uz.reestrmkd.backendjpa.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
            return Map.of("locked", false, "ownerUserId", null, "ownerRole", null, "expiresAt", null);
        }
        
        Map<String, Object> row = rows.get(0);
        return Map.of(
            "locked", true,
            "ownerUserId", row.get("owner_user_id"),
            "ownerRole", row.get("owner_role"),
            "expiresAt", row.get("expires_at") != null ? row.get("expires_at").toString() : null
        );
    }

    @Transactional
    public Map<String, Object> acquire(String applicationId, String userId, String role, Integer ttlSecondsRaw) {
        int ttl = Math.max(60, ttlSecondsRaw == null ? 1200 : ttlSecondsRaw);

        jdbc.update("delete from application_locks where application_id = cast(:appId as uuid)", Map.of("appId", applicationId));
        
        // Вызываем надежную функцию БД, которая внутри сама делает ON CONFLICT и пишет аудит
        List<Map<String, Object>> result = jdbc.queryForList("""
            select ok, reason, message, expires_at 
            from acquire_application_lock(cast(:appId as uuid), :userId, :role, :ttl)
            """, Map.of("appId", applicationId, "userId", userId, "role", role, "ttl", ttl));

        if (result.isEmpty()) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "RPC failed");
        
        Map<String, Object> row = result.get(0);
        if (!Boolean.TRUE.equals(row.get("ok"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, String.valueOf(row.get("message")));
        }
        
        return Map.of(
            "ok", true, 
            "reason", row.get("reason"), 
            "message", row.get("message"), 
            "expiresAt", row.get("expires_at") != null ? row.get("expires_at").toString() : null
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
            throw new ResponseStatusException(HttpStatus.CONFLICT, String.valueOf(row.get("message")));
        }
        
        return Map.of(
            "ok", true, 
            "reason", row.get("reason"), 
            "message", row.get("message"), 
            "expiresAt", row.get("expires_at") != null ? row.get("expires_at").toString() : null
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
            throw new ResponseStatusException(HttpStatus.CONFLICT, String.valueOf(row.get("message")));
        }
        
        return Map.of("ok", true, "reason", row.get("reason"), "message", row.get("message"));
    }
}