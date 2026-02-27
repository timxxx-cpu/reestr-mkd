package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.common.ApiException;

import java.util.*;

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
                "select id, label, type, floors_count, is_basement_block from building_blocks where building_id = ? order by label asc",
                buildingId
            );
            b.put("blocks", blocks);
        }
        return buildings;
    }

    @Transactional
    public Map<String, Object> createBuilding(String projectId, Map<String, Object> body) {
        String id = body.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("id"));
        jdbc.update(
            "insert into buildings(id, project_id, building_code, label, house_number, category, stage, date_start, date_end, construction_type, parking_type, infra_type, has_non_res_part, cadastre_number, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,now())",
            id, projectId,
            body.get("buildingCode"), body.get("label"), body.get("houseNumber"), body.get("category"),
            body.get("stage"), body.get("dateStart"), body.get("dateEnd"), body.get("constructionType"),
            body.get("parkingType"), body.get("infraType"), body.get("hasNonResPart"), body.get("cadastreNumber")
        );
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> updateBuilding(String buildingId, Map<String, Object> body) {
        int updated = jdbc.update(
            "update buildings set label=?, house_number=?, category=?, stage=?, date_start=?, date_end=?, construction_type=?, parking_type=?, infra_type=?, has_non_res_part=?, cadastre_number=?, updated_at=now() where id=?",
            body.get("label"), body.get("houseNumber"), body.get("category"), body.get("stage"), body.get("dateStart"), body.get("dateEnd"),
            body.get("constructionType"), body.get("parkingType"), body.get("infraType"), body.get("hasNonResPart"), body.get("cadastreNumber"), buildingId
        );
        if (updated == 0) throw new ApiException(NOT_FOUND, "NOT_FOUND", "Building not found");
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
}
