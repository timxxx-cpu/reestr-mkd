package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProjectService {
    private final JdbcTemplate jdbc;

    public ProjectService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> projects(String scope) {
        var projects = jdbc.queryForList("select * from projects where (? is null or scope_id = ?) order by updated_at desc", scope, scope);
        return Map.of("items", projects, "total", projects.size());
    }

    public List<Map<String, Object>> externalApplications(String scope) {
        return List.of(Map.of(
            "id", "EXT-10001",
            "source", "EPIGU",
            "externalId", "EP-2026-9912",
            "status", "NEW",
            "scope", scope
        ));
    }

    public Map<String, Object> summaryCounts(String scope) {
        Integer total = jdbc.queryForObject("select count(1) from applications where (? is null or scope_id = ?)", Integer.class, scope, scope);
        return Map.of("total", total == null ? 0 : total);
    }

    public Map<String, Object> applicationId(String projectId, String scope) {
        var rows = jdbc.queryForList("select id from applications where project_id=? and (? is null or scope_id=?) limit 1", projectId, scope, scope);
        return Map.of("applicationId", rows.isEmpty() ? null : rows.get(0).get("id"));
    }

    public Map<String, Object> validateStep(String projectId, String scope, String stepId) {
        return Map.of("ok", true, "stepId", stepId, "errors", List.of());
    }

    @Transactional
    public Map<String, Object> fromApplication(Map<String, Object> body) {
        String projectId = body.get("projectId") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("projectId"));
        jdbc.update("insert into projects(id, name, scope_id, updated_at) values (?, ?, ?, now()) on conflict (id) do update set updated_at=now()",
            projectId, body.getOrDefault("name", "Без названия"), body.get("scope"));
        return Map.of("ok", true, "projectId", projectId);
    }

    public Map<String, Object> context(String projectId, String scope) { return Map.of("projectId", projectId, "scope", scope); }

    @Transactional public Map<String, Object> contextBuildingSave(String projectId, Map<String, Object> body) { return Map.of("ok", true); }
    @Transactional public Map<String, Object> contextMetaSave(String projectId, Map<String, Object> body) { return Map.of("ok", true); }
    @Transactional public Map<String, Object> stepBlockStatusesSave(String projectId, Map<String, Object> body) { return Map.of("ok", true); }

    public Map<String, Object> contextRegistryDetails(String projectId) { return Map.of("projectId", projectId); }
    public Map<String, Object> passport(String projectId) { return Map.of("projectId", projectId); }
    @Transactional public Map<String, Object> updatePassport(String projectId, Map<String, Object> body) { return Map.of("ok", true); }
    @Transactional public Map<String, Object> participants(String projectId, String role, Map<String, Object> body) { return Map.of("ok", true); }

    @Transactional
    public Map<String, Object> documents(String projectId, Map<String, Object> body) {
        String id = body.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("id"));
        jdbc.update("insert into project_documents(id, project_id, file_name, url, updated_at) values (?, ?, ?, ?, now())",
            id, projectId, body.get("fileName"), body.get("url"));
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> deleteDoc(String documentId) {
        jdbc.update("delete from project_documents where id=?", documentId);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> deleteProject(String projectId) {
        jdbc.update("delete from projects where id=?", projectId);
        return Map.of("ok", true);
    }

    public Map<String, Object> integrationStatus(String projectId) {
        var rows = jdbc.queryForList("select integration_status from projects where id=?", projectId);
        return Map.of("integrationStatus", rows.isEmpty() ? null : rows.get(0).get("integration_status"));
    }

    @Transactional
    public Map<String, Object> updateIntegrationStatus(String projectId, Map<String, Object> body) {
        jdbc.update("update projects set integration_status=?, updated_at=now() where id=?", body.get("integrationStatus"), projectId);
        return Map.of("ok", true);
    }

    public Map<String, Object> parkingCounts(String projectId) {
        Integer count = jdbc.queryForObject("select count(1) from units u join floors f on f.id=u.floor_id join building_blocks b on b.id=f.block_id join buildings g on g.id=b.building_id where g.project_id=? and u.unit_type='parking'", Integer.class, projectId);
        return Map.of("parkingPlaces", count == null ? 0 : count);
    }

    public List<Map<String, Object>> buildingsSummary() {
        return jdbc.queryForList("select id, project_id, building_code, label, category from buildings order by created_at desc");
    }

    public List<Map<String, Object>> basements(String projectId) {
        return jdbc.queryForList("select * from basements where project_id=? order by level asc", projectId);
    }

    @Transactional
    public Map<String, Object> updateBasementLevel(String basementId, Integer level, Map<String, Object> body) {
        jdbc.update("update basements set parking_places=?, updated_at=now() where id=? and level=?",
            body.get("parkingPlaces"), basementId, level);
        return Map.of("ok", true);
    }

    public Map<String, Object> fullRegistry(String projectId) {
        var buildings = jdbc.queryForList("select * from buildings where project_id=?", projectId);
        return Map.of("projectId", projectId, "buildings", buildings);
    }

    public Map<String, Object> tepSummary(String projectId) {
        Double area = jdbc.queryForObject("select coalesce(sum(total_area),0) from units u join floors f on f.id=u.floor_id join building_blocks b on b.id=f.block_id join buildings g on g.id=b.building_id where g.project_id=?", Double.class, projectId);
        return Map.of("projectId", projectId, "totalArea", area == null ? 0d : area);
    }
}
