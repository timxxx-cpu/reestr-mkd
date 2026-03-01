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
                select id, label, type, floors_count, is_basement_block, linked_block_ids
                from building_blocks where building_id = :buildingId order by label asc
                """, Map.of("buildingId", buildingId));

            for (Map<String, Object> block : blocks) {
                String blockId = String.valueOf(block.get("id"));
                List<Map<String, Object>> extensions = queryList("""
                    select id, label, extension_type, floors_count, start_floor_index
                    from block_extensions where parent_block_id = :blockId order by created_at asc
                    """, Map.of("blockId", blockId));
                block.put("isBasementBlock", Boolean.TRUE.equals(block.get("is_basement_block")));
                block.put("linkedBlockIds", block.get("linked_block_ids"));
                block.put("extensions", extensions);
            }

            b.put("blocks", blocks);
        }

        return buildings;
    }

    @Transactional
    public Map<String, Object> createBuilding(String projectId, Map<String, Object> body) {
        Map<String, Object> buildingData = unwrapBuildingData(body);
        String geometryCandidateId = requireGeometryCandidateId(buildingData);
        String id = stringValOr(body.get("id"), UUID.randomUUID().toString());
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("projectId", projectId);
        params.put("buildingCode", buildingData.get("buildingCode"));
        params.put("label", buildingData.get("label"));
        params.put("houseNumber", buildingData.get("houseNumber"));
        params.put("addressId", stringVal(buildingData.get("addressId")));
        params.put("hasAddressId", buildingData.containsKey("addressId"));
        params.put("category", buildingData.get("category"));
        params.put("stage", buildingData.get("stage"));
        params.put("dateStart", buildingData.get("dateStart"));
        params.put("dateEnd", buildingData.get("dateEnd"));
        params.put("constructionType", buildingData.get("constructionType"));
        params.put("parkingType", buildingData.get("parkingType"));
        params.put("infraType", buildingData.get("infraType"));
        params.put("hasNonResPart", buildingData.get("hasNonResPart"));
        params.put("cadastreNumber", buildingData.get("cadastreNumber"));
        if (!Boolean.TRUE.equals(params.get("hasAddressId"))) {
            params.put("addressId", deriveBuildingAddressId(projectId, stringVal(buildingData.get("houseNumber"))));
            params.put("hasAddressId", params.get("addressId") != null);
        }

        execute("""
            insert into buildings(id, project_id, building_code, label, house_number, address_id, category, stage, date_start, date_end,
                                  construction_type, parking_type, infra_type, has_non_res_part, cadastre_number, updated_at)
            values (:id,:projectId,:buildingCode,:label,:houseNumber,cast(:addressId as uuid),:category,:stage,:dateStart,:dateEnd,
                    :constructionType,:parkingType,:infraType,:hasNonResPart,:cadastreNumber,now())
            """, params);

        assignBuildingGeometry(projectId, id, geometryCandidateId);
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> updateBuilding(String buildingId, Map<String, Object> body) {
        Map<String, Object> buildingData = unwrapBuildingData(body);
        String geometryCandidateId = requireGeometryCandidateId(buildingData);
        Map<String, Object> params = new HashMap<>();
        params.put("label", buildingData.get("label"));
        params.put("houseNumber", buildingData.get("houseNumber"));
        params.put("addressId", stringVal(buildingData.get("addressId")));
        params.put("hasAddressId", buildingData.containsKey("addressId"));
        params.put("category", buildingData.get("category"));
        params.put("stage", buildingData.get("stage"));
        params.put("dateStart", buildingData.get("dateStart"));
        params.put("dateEnd", buildingData.get("dateEnd"));
        params.put("constructionType", buildingData.get("constructionType"));
        params.put("parkingType", buildingData.get("parkingType"));
        params.put("infraType", buildingData.get("infraType"));
        params.put("hasNonResPart", buildingData.get("hasNonResPart"));
        params.put("cadastreNumber", buildingData.get("cadastreNumber"));
        params.put("buildingId", buildingId);
        if (!Boolean.TRUE.equals(params.get("hasAddressId"))) {
            String projectId = stringVal(queryScalar("select project_id from buildings where id = :id", Map.of("id", buildingId)));
            params.put("addressId", deriveBuildingAddressId(projectId, stringVal(buildingData.get("houseNumber"))));
            params.put("hasAddressId", params.get("addressId") != null);
        }

        int updated = execute("""
            update buildings set label=:label, house_number=:houseNumber,
                address_id = case when :hasAddressId then cast(:addressId as uuid) else address_id end,
                category=:category, stage=:stage,
                date_start=:dateStart, date_end=:dateEnd, construction_type=:constructionType, parking_type=:parkingType,
                infra_type=:infraType, has_non_res_part=:hasNonResPart, cadastre_number=:cadastreNumber, updated_at=now()
            where id=:buildingId
            """, params);
        if (updated == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Building not found");

        String projectId = stringVal(queryScalar("select project_id from buildings where id = :id", Map.of("id", buildingId)));
        if (projectId == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Building not found");
        assignBuildingGeometry(projectId, buildingId, geometryCandidateId);
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


    private String deriveBuildingAddressId(String projectId, String houseNumber) {
        if (projectId == null || projectId.isBlank() || houseNumber == null || houseNumber.isBlank()) return null;
        String parentAddressId = stringVal(queryScalar("select address_id from projects where id = :id", Map.of("id", projectId)));
        if (parentAddressId == null) return null;
        List<Map<String, Object>> parents = queryList("select district, street, mahalla, city from addresses where id = :id", Map.of("id", parentAddressId));
        if (parents.isEmpty()) return null;
        Map<String, Object> parent = parents.get(0);
        String id = UUID.randomUUID().toString();
        execute("""
            insert into addresses(id, dtype, versionrev, district, street, mahalla, city, building_no, full_address)
            values (:id, 'Address', 0, cast(:district as text), cast(:street as uuid), cast(:mahalla as uuid), :city, :buildingNo, :fullAddress)
            """, Map.of(
            "id", id,
            "district", stringVal(parent.get("district")),
            "street", stringVal(parent.get("street")),
            "mahalla", stringVal(parent.get("mahalla")),
            "city", stringVal(parent.get("city")),
            "buildingNo", houseNumber,
            "fullAddress", ((parent.get("city") == null ? "" : String.valueOf(parent.get("city")) + ", ") + "д. " + houseNumber)
        ));
        return id;
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

    private Object queryScalar(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        @SuppressWarnings("unchecked")
        List<Object> rows = query.getResultList();
        return rows.isEmpty() ? null : rows.get(0);
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

    private String stringVal(Object value) {
        if (value == null) return null;
        String v = String.valueOf(value);
        return v.isBlank() ? null : v;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> unwrapBuildingData(Map<String, Object> body) {
        if (body == null) return Map.of();
        Object nested = body.get("buildingData");
        if (nested instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return body;
    }

    private String requireGeometryCandidateId(Map<String, Object> buildingData) {
        String candidateId = stringVal(buildingData.get("geometryCandidateId"));
        if (candidateId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Geometry candidate is required for building creation");
        }
        return candidateId;
    }

    private void assignBuildingGeometry(String projectId, String buildingId, String candidateId) {
        try {
            queryScalar(
                "select out_building_id from assign_building_geometry_from_candidate(cast(:projectId as uuid), cast(:buildingId as uuid), cast(:candidateId as uuid))",
                Map.of("projectId", projectId, "buildingId", buildingId, "candidateId", candidateId)
            );
        } catch (RuntimeException ex) {
            String message = ex.getCause() != null ? ex.getCause().getMessage() : ex.getMessage();
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message == null ? "Geometry validation failed" : message);
        }
    }
}
