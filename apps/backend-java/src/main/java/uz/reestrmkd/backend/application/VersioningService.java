package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class VersioningService {
    private final JdbcTemplate jdbc;

    public VersioningService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> list(String entityType, String entityId) {
        String sql = "select * from object_versions where 1=1";
        if (entityType != null && !entityType.isBlank()) sql += " and entity_type = '" + entityType + "'";
        if (entityId != null && !entityId.isBlank()) sql += " and entity_id = '" + entityId + "'";
        sql += " order by created_at desc";
        return jdbc.queryForList(sql);
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> body) {
        String id = body.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("id"));
        jdbc.update("insert into object_versions(id, entity_type, entity_id, status, snapshot_json, comment, created_by, updated_at) values (?, ?, ?, ?, ?::jsonb, ?, ?, now())",
            id,
            body.get("entityType"),
            body.get("entityId"),
            body.getOrDefault("status", "PENDING"),
            body.getOrDefault("snapshot", "{}"),
            body.get("comment"),
            body.get("createdBy")
        );
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> approve(String versionId, String user) {
        jdbc.update("update object_versions set status='CURRENT', approved_by=?, approved_at=now(), updated_at=now() where id=?", user, versionId);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> decline(String versionId, String user, String reason) {
        jdbc.update("update object_versions set status='REJECTED', declined_by=?, declined_reason=?, declined_at=now(), updated_at=now() where id=?", user, reason, versionId);
        return Map.of("ok", true);
    }

    public Map<String, Object> snapshot(String versionId) {
        List<Map<String, Object>> rows = jdbc.queryForList("select snapshot_json from object_versions where id=?", versionId);
        return Map.of("snapshot", rows.isEmpty() ? null : rows.get(0).get("snapshot_json"));
    }

    @Transactional
    public Map<String, Object> restore(String versionId, String user) {
        jdbc.update("update object_versions set status='PREVIOUS', updated_at=now() where id=?", versionId);
        return Map.of("ok", true, "restoredBy", user);
    }
}
