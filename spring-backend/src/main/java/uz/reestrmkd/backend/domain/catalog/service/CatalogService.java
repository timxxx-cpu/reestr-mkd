package uz.reestrmkd.backend.domain.catalog.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.catalog.api.CatalogActiveRequestDto;
import uz.reestrmkd.backend.domain.catalog.api.CatalogUpsertRequestDto;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class CatalogService {
    private static final Set<String> ALLOWED = Set.of(
        "dict_project_statuses", "dict_application_statuses", "dict_external_systems", "dict_foundations", "dict_wall_materials",
        "dict_slab_types", "dict_roof_types", "dict_light_structure_types", "dict_parking_types", "dict_parking_construction_types",
        "dict_infra_types", "dict_mop_types", "dict_unit_types", "dict_room_types", "dict_system_users", "regions", "districts", "streets", "makhallas"
    );

    private final JdbcTemplate jdbcTemplate;

    public CatalogService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> getCatalog(String table, String activeOnly) {
        validate(table);

        boolean onlyActive = "true".equals(activeOnly);
        String activeClause = onlyActive ? (table.startsWith("dict_") ? " where is_active = true" : " where status = 1") : "";

        String sql = switch (table) {
            case "regions" ->
                "select id, soato, name_ru, name_uz, ordering, status from regions" + activeClause + " order by ordering asc, name_ru asc nulls last, name_uz asc nulls last";
            case "districts" ->
                "select id, soato, region_id, name_ru, name_uz, ordering, status from districts" + activeClause + " order by ordering asc, name_ru asc nulls last, name_uz asc nulls last";
            case "streets" ->
                "select id, district_soato, name as name_ru, name as name_uz, name, status from streets" + activeClause + " order by name asc nulls last";
            case "makhallas" ->
                "select id, district_soato, name as name_ru, name as name_uz, name, status from makhallas" + activeClause + " order by name asc nulls last";
            case "dict_system_users" ->
                "select u.username as id, u.username as code, u.full_name as name, ur.name_uk as role " +
                "from general.users u " +
                "left join general.user_attached_roles uar on u.id = uar.users_id " +
                "left join general.user_roles ur on ur.id = uar.user_roles_id " +
                (onlyActive ? "where u.status = true " : "") +
                "order by u.full_name asc";
            default ->
                "select * from " + table + activeClause + " order by sort_order asc, label asc";
        };

        return jdbcTemplate.queryForList(sql);
    }

    public void upsert(String table, CatalogUpsertRequestDto body) {
        validate(table);

        Map<String, Object> itemRaw = body.item() == null ? Map.of() : body.item();
        Map<String, Object> payload = new LinkedHashMap<>(itemRaw);

        String id = payload.get("id") == null ? null : String.valueOf(payload.get("id")).trim();
        if (id == null || id.isBlank()) {
            throw new ApiException("item.id is required", "VALIDATION_ERROR", null, 400);
        }

        payload.put("id", id);
        if (!payload.containsKey("sort_order") && payload.containsKey("sortOrder")) {
            payload.put("sort_order", payload.get("sortOrder"));
        }
        if (!payload.containsKey("is_active") && payload.containsKey("isActive")) {
            payload.put("is_active", payload.get("isActive"));
        }
        payload.putIfAbsent("sort_order", 100);
        payload.putIfAbsent("is_active", true);

        Set<String> tableColumns = loadTableColumns(table);
        Map<String, Object> filtered = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            if (tableColumns.contains(entry.getKey())) {
                filtered.put(entry.getKey(), entry.getValue());
            }
        }

        if (!filtered.containsKey("id")) {
            throw new ApiException("item.id is required", "VALIDATION_ERROR", null, 400);
        }
        if (filtered.isEmpty()) {
            throw new ApiException("No valid columns for upsert", "VALIDATION_ERROR", null, 400);
        }

        List<String> columns = new ArrayList<>(filtered.keySet());
        String placeholders = String.join(",", columns.stream().map(c -> "?").toList());
        String updates = String.join(",", columns.stream().filter(c -> !"id".equals(c)).map(c -> c + " = EXCLUDED." + c).toList());
        String sql = "insert into " + table + "(" + String.join(",", columns) + ") values (" + placeholders + ")"
            + (updates.isBlank() ? " on conflict (id) do nothing" : " on conflict (id) do update set " + updates);

        jdbcTemplate.update(sql, columns.stream().map(filtered::get).toArray());
    }

    public void setActive(String table, String id, CatalogActiveRequestDto body) {
        validate(table);
        jdbcTemplate.update("update " + table + " set is_active = ? where id = ?", body.isActive(), id);
    }

    private Set<String> loadTableColumns(String table) {
        List<String> rows = jdbcTemplate.queryForList(
            "select column_name from information_schema.columns where table_schema='public' and table_name=?",
            String.class,
            table
        );
        return Set.copyOf(rows);
    }

    private void validate(String table) {
        if (!ALLOWED.contains(table)) {
            throw new ApiException("РўР°Р±Р»РёС†Р° РЅРµ СЂР°Р·СЂРµС€РµРЅР°", "INVALID_TABLE", null, 400);
        }
    }
}
