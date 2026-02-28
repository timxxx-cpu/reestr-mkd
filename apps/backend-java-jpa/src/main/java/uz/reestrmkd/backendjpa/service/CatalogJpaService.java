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

import java.util.*;

@Service
@RequiredArgsConstructor
public class CatalogJpaService {
    private static final Set<String> ALLOWED = Set.of(
        "dict_project_statuses", "dict_application_statuses", "dict_external_systems", "dict_foundations",
        "dict_wall_materials", "dict_slab_types", "dict_roof_types", "dict_light_structure_types",
        "dict_parking_types", "dict_parking_construction_types", "dict_infra_types", "dict_mop_types",
        "dict_unit_types", "dict_room_types", "dict_system_users"
    );

    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(String table, boolean activeOnly) {
        validateTable(table);
        String orderField = "dict_system_users".equals(table) ? "name" : "label";
        String sql = "select * from " + table + (activeOnly ? " where is_active = true" : "") +
            " order by sort_order asc, " + orderField + " asc";
        return queryList(sql, Map.of());
    }

    @Transactional
    public Map<String, Object> upsert(String table, Map<String, Object> item) {
        validateTable(table);
        if (item == null || item.get("id") == null || String.valueOf(item.get("id")).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "item.id is required");
        }

        String id = String.valueOf(item.get("id")).trim();
        String code = item.get("code") == null ? null : String.valueOf(item.get("code"));
        String label = item.get("label") == null ? null : String.valueOf(item.get("label"));
        int sort = item.get("sort_order") instanceof Number n ? n.intValue() :
            item.get("sortOrder") instanceof Number n2 ? n2.intValue() : 100;
        boolean active = item.get("is_active") instanceof Boolean b ? b :
            item.get("isActive") instanceof Boolean b2 ? b2 : true;

        String sql = "insert into " + table + "(id, code, label, sort_order, is_active) values (:id, :code, :label, :sort, :active) " +
            "on conflict (id) do update set code=excluded.code, label=excluded.label, sort_order=excluded.sort_order, is_active=excluded.is_active";
        execute(sql, Map.of("id", id, "code", code, "label", label, "sort", sort, "active", active));

        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> setActive(String table, String id, Boolean isActive) {
        validateTable(table);
        if (isActive == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "isActive must be a boolean");
        execute("update " + table + " set is_active = :isActive where id = :id", Map.of("isActive", isActive, "id", id));
        return Map.of("ok", true);
    }

    private void validateTable(String table) {
        if (!ALLOWED.contains(table)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Таблица не разрешена");
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
}
