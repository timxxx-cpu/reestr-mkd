package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.common.ApiException;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class CatalogService {
    private static final Set<String> ALLOWED = Set.of(
        "dict_project_statuses", "dict_application_statuses", "dict_external_systems", "dict_foundations",
        "dict_wall_materials", "dict_slab_types", "dict_roof_types", "dict_light_structure_types",
        "dict_parking_types", "dict_parking_construction_types", "dict_infra_types", "dict_mop_types",
        "dict_unit_types", "dict_room_types", "dict_system_users"
    );

    private final JdbcTemplate jdbc;

    public CatalogService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> list(String table, boolean activeOnly) {
        validateTable(table);
        String orderField = "dict_system_users".equals(table) ? "name" : "label";
        String sql = "select * from " + table + (activeOnly ? " where is_active = true" : "") +
            " order by sort_order asc, " + orderField + " asc";
        return jdbc.queryForList(sql);
    }

    public Map<String, Object> upsert(String table, Map<String, Object> item) {
        validateTable(table);
        if (item == null || item.get("id") == null || String.valueOf(item.get("id")).isBlank()) {
            throw new ApiException(BAD_REQUEST, "VALIDATION_ERROR", "item.id is required");
        }

        String id = String.valueOf(item.get("id")).trim();
        String code = item.get("code") == null ? null : String.valueOf(item.get("code"));
        String label = item.get("label") == null ? null : String.valueOf(item.get("label"));
        int sort = item.get("sort_order") instanceof Number n ? n.intValue() :
            item.get("sortOrder") instanceof Number n2 ? n2.intValue() : 100;
        boolean active = item.get("is_active") instanceof Boolean b ? b :
            item.get("isActive") instanceof Boolean b2 ? b2 : true;

        jdbc.update(
            "insert into " + table + "(id, code, label, sort_order, is_active) values (?, ?, ?, ?, ?) " +
                "on conflict (id) do update set code=excluded.code, label=excluded.label, sort_order=excluded.sort_order, is_active=excluded.is_active",
            id, code, label, sort, active
        );

        return Map.of("ok", true);
    }

    public Map<String, Object> setActive(String table, String id, Boolean isActive) {
        validateTable(table);
        if (isActive == null) throw new ApiException(BAD_REQUEST, "VALIDATION_ERROR", "isActive must be a boolean");
        jdbc.update("update " + table + " set is_active = ? where id = ?", isActive, id);
        return Map.of("ok", true);
    }

    private void validateTable(String table) {
        if (!ALLOWED.contains(table)) throw new ApiException(BAD_REQUEST, "INVALID_TABLE", "Таблица не разрешена");
    }
}
