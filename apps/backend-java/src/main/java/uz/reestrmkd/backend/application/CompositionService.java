package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.common.ApiException;

import java.util.*;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
public class CompositionService {
    private final JdbcTemplate jdbc;

    public CompositionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> listBuildings(String projectId) {
        List<Map<String, Object>> buildings = jdbc.queryForList(
            "select id, building_code, label, house_number, category, stage, date_start, date_end, construction_type, parking_type, infra_type, has_non_res_part, cadastre_number from buildings where project_id = ? order by created_at asc",
            projectId
        );

        for (Map<String, Object> b : buildings) {
            String buildingId = String.valueOf(b.get("id"));
            List<Map<String, Object>> blocks = jdbc.queryForList(
                "select id, label, type, floors_count, is_basement_block, linked_block_ids from building_blocks where building_id = ? order by label asc",
                buildingId
            );

            for (Map<String, Object> block : blocks) {
                String blockId = String.valueOf(block.get("id"));
                List<Map<String, Object>> extensions = jdbc.queryForList(
                    "select id, label, extension_type, floors_count, start_floor_index from block_extensions where parent_block_id = ? order by created_at asc",
                    blockId
                );
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
        String id = body.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("id"));
        jdbc.update(
            "insert into buildings(id, project_id, building_code, label, house_number, category, stage, date_start, date_end, construction_type, parking_type, infra_type, has_non_res_part, cadastre_number, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,now())",
            id, projectId,
            buildingData.get("buildingCode"), buildingData.get("label"), buildingData.get("houseNumber"), buildingData.get("category"),
            buildingData.get("stage"), buildingData.get("dateStart"), buildingData.get("dateEnd"), buildingData.get("constructionType"),
            buildingData.get("parkingType"), buildingData.get("infraType"), buildingData.get("hasNonResPart"), buildingData.get("cadastreNumber")
        );

        assignBuildingGeometry(projectId, id, geometryCandidateId);
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> updateBuilding(String buildingId, Map<String, Object> body) {
        Map<String, Object> buildingData = unwrapBuildingData(body);
        String geometryCandidateId = requireGeometryCandidateId(buildingData);
        int updated = jdbc.update(
            "update buildings set label=?, house_number=?, category=?, stage=?, date_start=?, date_end=?, construction_type=?, parking_type=?, infra_type=?, has_non_res_part=?, cadastre_number=?, updated_at=now() where id=?",
            buildingData.get("label"), buildingData.get("houseNumber"), buildingData.get("category"), buildingData.get("stage"), buildingData.get("dateStart"), buildingData.get("dateEnd"),
            buildingData.get("constructionType"), buildingData.get("parkingType"), buildingData.get("infraType"), buildingData.get("hasNonResPart"), buildingData.get("cadastreNumber"), buildingId
        );
        if (updated == 0) throw new ApiException(NOT_FOUND, "NOT_FOUND", "Building not found");

        String projectId;
        try {
            projectId = jdbc.queryForObject("select project_id from buildings where id = ?", String.class, buildingId);
        } catch (EmptyResultDataAccessException ex) {
            throw new ApiException(NOT_FOUND, "NOT_FOUND", "Building not found");
        }
        assignBuildingGeometry(projectId, buildingId, geometryCandidateId);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> deleteBuilding(String buildingId) {
        int updated = jdbc.update("delete from buildings where id = ?", buildingId);
        if (updated == 0) throw new ApiException(NOT_FOUND, "NOT_FOUND", "Building not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> updateBuildingCadastre(String buildingId, Map<String, Object> body) {
        int updated = jdbc.update("update buildings set cadastre_number=?, updated_at=now() where id=?",
            body.get("cadastreNumber"), buildingId);
        if (updated == 0) throw new ApiException(NOT_FOUND, "NOT_FOUND", "Building not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> updateUnitCadastre(String unitId, Map<String, Object> body) {
        int updated = jdbc.update("update units set cadastre_number=?, updated_at=now() where id=?",
            body.get("cadastreNumber"), unitId);
        if (updated == 0) throw new ApiException(NOT_FOUND, "NOT_FOUND", "Unit not found");
        return Map.of("ok", true);
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
        Object raw = buildingData.get("geometryCandidateId");
        if (raw == null || String.valueOf(raw).isBlank()) {
            throw new ApiException(BAD_REQUEST, "VALIDATION_ERROR", "Geometry candidate is required for building creation");
        }
        return String.valueOf(raw);
    }

    private void assignBuildingGeometry(String projectId, String buildingId, String candidateId) {
        try {
            jdbc.queryForMap(
                "select * from assign_building_geometry_from_candidate(cast(? as uuid), cast(? as uuid), cast(? as uuid))",
                projectId, buildingId, candidateId
            );
        } catch (DataAccessException ex) {
            String message = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
            throw new ApiException(BAD_REQUEST, "GEOMETRY_VALIDATION_ERROR", message == null ? "Geometry validation failed" : message);
        } catch (RuntimeException ex) {
            throw new ApiException(INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", ex.getMessage());
        }
    }
}
