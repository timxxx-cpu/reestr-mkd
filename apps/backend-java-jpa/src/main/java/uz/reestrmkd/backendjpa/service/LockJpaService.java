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

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class LockJpaService {
    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public Map<String, Object> get(String applicationId) {
        List<Map<String, Object>> rows = queryList("""
            select owner_user_id, owner_role, expires_at from application_locks where application_id = :applicationId
            """, Map.of("applicationId", applicationId));
        if (rows.isEmpty()) return Map.of("locked", false, "ownerUserId", null, "ownerRole", null, "expiresAt", null);
        Map<String, Object> row = rows.get(0);
        return Map.of(
            "locked", true,
            "ownerUserId", row.get("owner_user_id"),
            "ownerRole", row.get("owner_role"),
            "expiresAt", row.get("expires_at")
        );
    }

    @Transactional
    public Map<String, Object> acquire(String applicationId, String userId, String role, Integer ttlSecondsRaw) {
        int ttl = Math.max(60, ttlSecondsRaw == null ? 1200 : ttlSecondsRaw);
        ensureApplicationExists(applicationId);
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(ttl);

        List<Map<String, Object>> rows = queryList("""
            select owner_user_id, expires_at from application_locks
            where application_id = :applicationId
            for update
            """, Map.of("applicationId", applicationId));

        if (rows.isEmpty()) {
            execute("""
                insert into application_locks(application_id, owner_user_id, owner_role, expires_at)
                values (:applicationId, :userId, :role, :expiresAt)
                """, Map.of("applicationId", applicationId, "userId", userId, "role", role, "expiresAt", Timestamp.from(exp)));
            return Map.of("ok", true, "reason", "LOCK_ACQUIRED", "message", "Lock acquired", "expiresAt", exp.toString());
        }

        Map<String, Object> row = rows.get(0);
        Instant currentExp = toInstant(row.get("expires_at"));
        String owner = String.valueOf(row.get("owner_user_id"));
        if (currentExp != null && currentExp.isAfter(now) && !userId.equals(owner)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Application is locked by another user");
        }

        execute("""
            update application_locks set owner_user_id=:userId, owner_role=:role, expires_at=:expiresAt
            where application_id=:applicationId
            """, Map.of("userId", userId, "role", role, "expiresAt", Timestamp.from(exp), "applicationId", applicationId));

        return Map.of("ok", true, "reason", "LOCK_REACQUIRED", "message", "Lock reacquired", "expiresAt", exp.toString());
    }

    @Transactional
    public Map<String, Object> refresh(String applicationId, String userId, Integer ttlSecondsRaw) {
        int ttl = Math.max(60, ttlSecondsRaw == null ? 1200 : ttlSecondsRaw);
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(ttl);

        List<Map<String, Object>> rows = queryList("""
            select owner_user_id, expires_at from application_locks where application_id = :applicationId for update
            """, Map.of("applicationId", applicationId));

        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Lock not found");

        Map<String, Object> row = rows.get(0);
        String owner = String.valueOf(row.get("owner_user_id"));
        Instant currentExp = toInstant(row.get("expires_at"));

        if (!userId.equals(owner)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Lock owned by another user");
        if (currentExp != null && currentExp.isBefore(now)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Lock expired");

        execute("update application_locks set expires_at = :exp where application_id=:app", Map.of("exp", Timestamp.from(exp), "app", applicationId));
        return Map.of("ok", true, "reason", "LOCK_REFRESHED", "message", "Lock refreshed", "expiresAt", exp.toString());
    }

    @Transactional
    public Map<String, Object> release(String applicationId, String userId) {
        List<Map<String, Object>> rows = queryList("""
            select owner_user_id from application_locks where application_id = :applicationId for update
            """, Map.of("applicationId", applicationId));

        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Lock not found");

        String owner = String.valueOf(rows.get(0).get("owner_user_id"));
        if (!userId.equals(owner)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Lock owned by another user");

        execute("delete from application_locks where application_id = :applicationId", Map.of("applicationId", applicationId));
        return Map.of("ok", true, "reason", "LOCK_RELEASED", "message", "Lock released");
    }

    private void ensureApplicationExists(String applicationId) {
        List<Map<String, Object>> rows = queryList("select id from applications where id = :id", Map.of("id", applicationId));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found");
    }

    private List<Map<String, Object>> queryList(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql, Tuple.class);
        params.forEach(query::setParameter);
        @SuppressWarnings("unchecked")
        List<Tuple> tuples = query.getResultList();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Tuple tuple : tuples) {
            Map<String, Object> row = new LinkedHashMap<>();
            tuple.getElements().forEach(e -> row.put(e.getAlias(), tuple.get(e)));
            rows.add(row);
        }
        return rows;
    }

    private int execute(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query.executeUpdate();
    }

    private Instant toInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Timestamp ts) return ts.toInstant();
        return null;
    }
}
