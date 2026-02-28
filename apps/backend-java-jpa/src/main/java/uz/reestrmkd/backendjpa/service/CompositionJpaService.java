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
public class CompositionJpaService {
    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listBuildings(String projectId) {
        List<Map<String, Object>> buildings = queryList("""
            select id, building_code, label, house_number, category, stage, date_start, date_end, construction_type,
                   parking_type, infra_type, has_non_res_part, cadastre_number
            from buildings where project_id = :projectId order by created_at asc
            """, Map.of("projectId", projectId));

        for (Map<String, Object> b : buildings) {
            String buildingId = String.valueOf(b.get("id"));
            List<Map<String, Object>> blocks = queryList("""
                select id, label, type, floors_count, is_basement_block
                from building_blocks where building_id = :buildingId order by label asc
                """, Map.of("buildingId", buildingId));
            b.put("blocks", blocks);
        }

        return buildings;
    }

    @Transactional
    public Map<String, Object> createBuilding(String projectId, Map<String, Object> body) {
        String id = stringValOr(body.get("id"), UUID.randomUUID().toString());
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("projectId", projectId);
        params.put("buildingCode", body.get("buildingCode"));
        params.put("label", body.get("label"));
        params.put("houseNumber", body.get("houseNumber"));
        params.put("category", body.get("category"));
        params.put("stage", body.get("stage"));
        params.put("dateStart", body.get("dateStart"));
        params.put("dateEnd", body.get("dateEnd"));
        params.put("constructionType", body.get("constructionType"));
        params.put("parkingType", body.get("parkingType"));
        params.put("infraType", body.get("infraType"));
        params.put("hasNonResPart", body.get("hasNonResPart"));
        params.put("cadastreNumber", body.get("cadastreNumber"));

        execute("""
            insert into buildings(id, project_id, building_code, label, house_number, category, stage, date_start, date_end,
                                  construction_type, parking_type, infra_type, has_non_res_part, cadastre_number, updated_at)
            values (:id,:projectId,:buildingCode,:label,:houseNumber,:category,:stage,:dateStart,:dateEnd,
                    :constructionType,:parkingType,:infraType,:hasNonResPart,:cadastreNumber,now())
            """, params);
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> updateBuilding(String buildingId, Map<String, Object> body) {
        Map<String, Object> params = new HashMap<>();
        params.put("label", body.get("label"));
        params.put("houseNumber", body.get("houseNumber"));
        params.put("category", body.get("category"));
        params.put("stage", body.get("stage"));
        params.put("dateStart", body.get("dateStart"));
        params.put("dateEnd", body.get("dateEnd"));
        params.put("constructionType", body.get("constructionType"));
        params.put("parkingType", body.get("parkingType"));
        params.put("infraType", body.get("infraType"));
        params.put("hasNonResPart", body.get("hasNonResPart"));
        params.put("cadastreNumber", body.get("cadastreNumber"));
        params.put("buildingId", buildingId);

        int updated = execute("""
            update buildings set label=:label, house_number=:houseNumber, category=:category, stage=:stage,
                date_start=:dateStart, date_end=:dateEnd, construction_type=:constructionType, parking_type=:parkingType,
                infra_type=:infraType, has_non_res_part=:hasNonResPart, cadastre_number=:cadastreNumber, updated_at=now()
            where id=:buildingId
            """, params);
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Building not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> deleteBuilding(String buildingId) {
        int deleted = execute("delete from buildings where id = :id", Map.of("id", buildingId));
        if (deleted == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Building not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> updateBuildingCadastre(String buildingId, Map<String, Object> body) {
        int updated = execute("update buildings set cadastre_number=:cadastreNumber, updated_at=now() where id=:id",
            Map.of("cadastreNumber", body.get("cadastreNumber"), "id", buildingId));
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Building not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> updateUnitCadastre(String unitId, Map<String, Object> body) {
        int updated = execute("update units set cadastre_number=:cadastreNumber, updated_at=now() where id=:id",
            Map.of("cadastreNumber", body.get("cadastreNumber"), "id", unitId));
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found");
        return Map.of("ok", true);
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

    private int execute(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query.executeUpdate();
    }

    private Map<String, Object> tupleToMap(Tuple tuple) {
        Map<String, Object> row = new LinkedHashMap<>();
        tuple.getElements().forEach(e -> row.put(e.getAlias(), tuple.get(e)));
        return row;
    }

    private String stringValOr(Object value, String fallback) {
        if (value == null) return fallback;
        String v = String.valueOf(value);
        return v.isBlank() ? fallback : v;
    }
}
