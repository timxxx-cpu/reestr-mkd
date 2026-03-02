package uz.reestrmkd.backendjpa.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CatalogJpaService {
  private static final Set<String> ALLOWED = Set.of(
        "dict_project_statuses", "dict_application_statuses", "dict_external_systems", "dict_foundations",
        "dict_wall_materials", "dict_slab_types", "dict_roof_types", "dict_light_structure_types",
        "dict_parking_types", "dict_parking_construction_types", "dict_infra_types", "dict_mop_types",
        "dict_unit_types", "dict_room_types", "dict_system_users",
        "regions", "districts", "streets", "makhallas" // Добавили адреса!
    );

    // Заменяем EntityManager на инструмент, который не падает при работе с JSON/UUID
    private final NamedParameterJdbcTemplate jdbc;

   @Transactional(readOnly = true)
    public List<Map<String, Object>> list(String table, boolean activeOnly) {
        validateTable(table);

        // Кастомные выборки для таблиц адресов (они не имеют is_active и sort_order)
        if ("regions".equals(table)) {
            return jdbc.queryForList("select id, soato as code, name_ru as label from regions where status = 1 order by ordering asc", Map.of());
        }
        if ("districts".equals(table)) {
            return jdbc.queryForList("select id, soato as code, name_ru as label, region_id from districts where status = 1 order by ordering asc", Map.of());
        }
        if ("streets".equals(table)) {
            return jdbc.queryForList("select id, code, name as label, district_soato from streets where status = 1 order by name asc", Map.of());
        }
        if ("makhallas".equals(table)) {
            return jdbc.queryForList("select id, code, name as label, district_soato from makhallas where status = 1 order by name asc", Map.of());
        }

        // Стандартная логика для dict_* таблиц
        String orderField = "dict_system_users".equals(table) ? "name" : "label";
        String sql = "select * from " + table + (activeOnly ? " where is_active = true" : "") +
            " order by sort_order asc, " + orderField + " asc";
            
        return jdbc.queryForList(sql, Map.of());
    }

    @Transactional
    public Map<String, Object> upsert(String table, Map<String, Object> item) {
        validateTable(table);
        if (item == null || item.get("id") == null || String.valueOf(item.get("id")).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "item.id is required");
        }

        String id = String.valueOf(item.get("id")).trim();
        String code = item.get("code") == null ? null : String.valueOf(item.get("code"));
        int sort = item.get("sort_order") instanceof Number n ? n.intValue() :
            item.get("sortOrder") instanceof Number n2 ? n2.intValue() : 100;
        boolean active = item.get("is_active") instanceof Boolean b ? b :
            item.get("isActive") instanceof Boolean b2 ? b2 : true;

        // Явно приводим ID к типу uuid (cast(:id as uuid)), чтобы PostgreSQL не ругался
        if ("dict_system_users".equals(table)) {
            String name = item.get("name") == null ? null : String.valueOf(item.get("name"));
            String role = item.get("role") == null ? "technician" : String.valueOf(item.get("role"));
            String groupName = item.get("group_name") == null ? null : String.valueOf(item.get("group_name"));

            String sql = "insert into " + table + "(id, code, name, role, group_name, sort_order, is_active) " +
                "values (cast(:id as uuid), :code, :name, :role, :group, :sort, :active) " +
                "on conflict (id) do update set code=excluded.code, name=excluded.name, role=excluded.role, " +
                "group_name=excluded.group_name, sort_order=excluded.sort_order, is_active=excluded.is_active";
            jdbc.update(sql, Map.of("id", id, "code", code, "name", name, "role", role, "group", groupName, "sort", sort, "active", active));
        } else {
            String label = item.get("label") == null ? null : String.valueOf(item.get("label"));
            String sql = "insert into " + table + "(id, code, label, sort_order, is_active) " +
                "values (cast(:id as uuid), :code, :label, :sort, :active) " +
                "on conflict (id) do update set code=excluded.code, label=excluded.label, " +
                "sort_order=excluded.sort_order, is_active=excluded.is_active";
            jdbc.update(sql, Map.of("id", id, "code", code, "label", label, "sort", sort, "active", active));
        }

        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> setActive(String table, String id, Boolean isActive) {
        validateTable(table);
        if (isActive == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "isActive must be a boolean");
        
        jdbc.update("update " + table + " set is_active = :isActive where id = cast(:id as uuid)", 
            Map.of("isActive", isActive, "id", id));
        return Map.of("ok", true);
    }

    private void validateTable(String table) {
        if (!ALLOWED.contains(table)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Таблица не разрешена");
    }
}