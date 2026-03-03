package uz.reestrmkd.backendjpa.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.persistence.Tuple;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class VersioningJpaService {
    private final ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager em;

    public VersioningJpaService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Object list(String entityType, String entityId) {
        String normalizedType = entityType == null ? null : entityType.trim();
        String normalizedId = entityId == null ? null : entityId.trim();
        if (normalizedType == null || normalizedType.isBlank() || normalizedId == null || normalizedId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "entityType and entityId are required");
        }
        return queryList("""
            select * from object_versions
            where entity_type = :entityType and entity_id = cast(:entityId as uuid)
            order by version_number desc
            """, Map.of("entityType", normalizedType, "entityId", normalizedId));
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> body) {
        String entityType = stringVal(body.get("entityType"));
        String entityId = stringVal(body.get("entityId"));
        if (entityType == null || entityId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "entityType and entityId are required");
        }

        List<Map<String, Object>> latestRows = queryList("""
            select version_number from object_versions
            where entity_type = :entityType and entity_id = cast(:entityId as uuid)
            order by version_number desc limit 1
            """, Map.of("entityType", entityType, "entityId", entityId));
        int versionNumber = latestRows.isEmpty() ? 1 : toInt(latestRows.get(0).get("version_number")) + 1;

        execute("""
            update object_versions
            set version_status = 'PREVIOUS', updated_at = now()
             where entity_type = :entityType and entity_id = cast(:entityId as uuid) and version_status = 'PENDING'
            """, Map.of("entityType", entityType, "entityId", entityId));

        String id = stringValOr(body.get("id"), UUID.randomUUID().toString());
        Map<String, Object> insertParams = new LinkedHashMap<>();
        insertParams.put("id", id);
        insertParams.put("entityType", entityType);
        insertParams.put("entityId", entityId);
        insertParams.put("versionNumber", versionNumber);
        insertParams.put("snapshot", toJson(body.getOrDefault("snapshotData", Map.of())));
        insertParams.put("createdBy", stringVal(body.get("createdBy")));
        insertParams.put("applicationId", stringVal(body.get("applicationId")));

        execute("""
            insert into object_versions (id, entity_type, entity_id, version_number, version_status, snapshot_data, created_by, application_id, updated_at)
           values (cast(:id as uuid), :entityType, :entityId, :versionNumber, 'PENDING', cast(:snapshot as jsonb), :createdBy, :applicationId, now())
         """, insertParams);

        return getById(id);
    }

    @Transactional
    public Map<String, Object> approve(String versionId, Map<String, Object> body) {
        Map<String, Object> current = getById(versionId);
        execute("""
            update object_versions
            set version_status = 'PREVIOUS', updated_at = now()
            where entity_type = :entityType and entity_id = :entityId and version_status = 'CURRENT' and id <> :versionId
            """, Map.of("entityType", current.get("entity_type"), "entityId", current.get("entity_id"), "versionId", versionId));

        execute("""
            update object_versions
            set version_status = 'CURRENT', approved_by = :approvedBy, declined_by = null, decline_reason = null, updated_at = now()
            where id = :versionId
            """, Map.of("versionId", versionId, "approvedBy", stringVal(body == null ? null : body.get("approvedBy"))));

        return getById(versionId);
    }

    @Transactional
    public Map<String, Object> decline(String versionId, Map<String, Object> body) {
        execute("""
            update object_versions
            set version_status = 'REJECTED', decline_reason = :reason, declined_by = :declinedBy, updated_at = now()
            where id = :versionId
            """, Map.of(
            "versionId", versionId,
            "reason", stringVal(body == null ? null : body.get("reason")),
            "declinedBy", stringVal(body == null ? null : body.get("declinedBy"))
        ));
        return getById(versionId);
    }

    @Transactional(readOnly = true)
    public Object snapshot(String versionId) {
      Map<String, Object> row = queryOne("select snapshot_data::text as snapshot_data from object_versions where id = :versionId", Map.of("versionId", versionId));
        if (row == null) return Map.of();
        return normalizeSnapshotValue(row.get("snapshot_data"));
    }

    @Transactional
    public Map<String, Object> restore(String versionId) {
        Map<String, Object> current = getById(versionId);

        execute("""
            update object_versions
            set version_status = 'PREVIOUS', updated_at = now()
           where entity_type = :entityType and entity_id = cast(:entityId as uuid) and version_status = 'PENDING' and id <> :versionId
            """, Map.of("entityType", current.get("entity_type"), "entityId", current.get("entity_id"), "versionId", versionId));

        execute("""
            update object_versions set version_status = 'PENDING', updated_at = now() where id = :versionId
            """, Map.of("versionId", versionId));

        return getById(versionId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getById(String id) {
        Map<String, Object> row = queryOne("select * from object_versions where id = :id", Map.of("id", id));
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Version not found");
        return row;
    }

    private List<Map<String, Object>> queryList(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql, Tuple.class);
        params.forEach(query::setParameter);
        @SuppressWarnings("unchecked")
        List<Tuple> tuples = query.getResultList();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Tuple tuple : tuples) rows.add(tupleToMap(tuple));
        return rows;
    }

    private Map<String, Object> queryOne(String sql, Map<String, Object> params) {
        List<Map<String, Object>> rows = queryList(sql, params);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private int execute(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query.executeUpdate();
    }

    private Map<String, Object> tupleToMap(Tuple tuple) {
        Map<String, Object> row = new LinkedHashMap<>();
            tuple.getElements().forEach(e -> {
            String alias = e.getAlias();
            Object value = tuple.get(e);
            if ("snapshot_data".equals(alias)) {
                row.put(alias, normalizeSnapshotValue(value));
            } else {
                row.put(alias, value);
            }
        });
        return row;
    }

    private Object normalizeSnapshotValue(Object value) {
        if (value == null) return null;
        if (value instanceof Map<?, ?> || value instanceof List<?>) return value;

        if (value instanceof String s) {
            try {
                return objectMapper.readValue(s, Object.class);
            } catch (JsonProcessingException ignored) {
                return s;
            }
        }

        String asString = String.valueOf(value);
        if (asString.startsWith("{") || asString.startsWith("[")) {
            try {
                return objectMapper.readValue(asString, Object.class);
            } catch (JsonProcessingException ignored) {
                return value;
            }
        }
        return value;
    }

    private String toJson(Object value) {
        try {
            if (value instanceof String s) return s;
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize snapshot", e);
        }
    }

    private String stringVal(Object value) {
        if (value == null) return null;
        return String.valueOf(value);
    }

    private String stringValOr(Object value, String fallback) {
        String val = stringVal(value);
        return val == null || val.isBlank() ? fallback : val;
    }

    private int toInt(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        return Integer.parseInt(String.valueOf(value));
    }
}
