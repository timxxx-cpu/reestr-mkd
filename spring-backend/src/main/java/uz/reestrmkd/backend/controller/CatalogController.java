package uz.reestrmkd.backend.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.CatalogActiveRequestDto;
import uz.reestrmkd.backend.dto.CatalogUpsertRequestDto;
import uz.reestrmkd.backend.dto.ItemsResponseDto;
import uz.reestrmkd.backend.dto.OkResponseDto;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.service.SecurityPolicyService;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/catalogs")
public class CatalogController {
    private static final Set<String> ALLOWED = Set.of(
        "dict_project_statuses", "dict_application_statuses", "dict_external_systems", "dict_foundations", "dict_wall_materials",
        "dict_slab_types", "dict_roof_types", "dict_light_structure_types", "dict_parking_types", "dict_parking_construction_types",
        "dict_infra_types", "dict_mop_types", "dict_unit_types", "dict_room_types", "dict_system_users", "regions", "districts", "streets", "makhallas"
    );
    private final JdbcTemplate jdbcTemplate;
    private final SecurityPolicyService securityPolicyService;

    public CatalogController(JdbcTemplate jdbcTemplate, SecurityPolicyService securityPolicyService) {
        this.jdbcTemplate = jdbcTemplate;
        this.securityPolicyService = securityPolicyService;
    }

    @GetMapping("/{table}")
    public ItemsResponseDto getCatalog(@PathVariable String table, @RequestParam(required = false) String activeOnly) {
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

        return new ItemsResponseDto(jdbcTemplate.queryForList(sql));
    }

    @PostMapping("/{table}/upsert")
    public OkResponseDto upsert(@PathVariable String table, @Valid @RequestBody CatalogUpsertRequestDto body) {
        requirePolicy("catalogs", "mutate", "Role cannot modify catalogs");
        validate(table);

        Map<String, Object> itemRaw = body.item() == null ? Map.of() : body.item();
        Map<String, Object> payload = new LinkedHashMap<>(itemRaw);

        String id = payload.get("id") == null ? null : String.valueOf(payload.get("id")).trim();
        if (id == null || id.isBlank()) throw new ApiException("item.id is required", "VALIDATION_ERROR", null, 400);

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
        return new OkResponseDto(true);
    }

    @PutMapping("/{table}/{id}/active")
    public ResponseEntity<OkResponseDto> setActive(@PathVariable String table, @PathVariable String id, @Valid @RequestBody CatalogActiveRequestDto body) {
        validate(table);
        jdbcTemplate.update("update " + table + " set is_active = ? where id = ?", body.isActive(), id);
        return ResponseEntity.ok(new OkResponseDto(true));
    }

    private Set<String> loadTableColumns(String table) {
        List<String> rows = jdbcTemplate.queryForList(
            "select column_name from information_schema.columns where table_schema='public' and table_name=?",
            String.class,
            table
        );
        return Set.copyOf(rows);
    }

    private void validate(String table) { if (!ALLOWED.contains(table)) throw new ApiException("Таблица не разрешена", "INVALID_TABLE", null, 400); }

    private void requirePolicy(String module, String action, String message) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ActorPrincipal actor)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRole(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}