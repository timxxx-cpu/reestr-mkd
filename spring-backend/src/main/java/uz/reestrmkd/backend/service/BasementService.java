package uz.reestrmkd.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class BasementService {
    private final JdbcTemplate jdbcTemplate;

    public BasementService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> getProjectBasements(UUID projectId) {
        return jdbcTemplate.queryForList(
            """
                select bb.*
                from building_blocks bb
                join buildings b on b.id = bb.building_id
                where b.project_id = ? and bb.is_basement_block = true
                order by bb.created_at asc
            """,
            projectId
        );
    }

    public List<Map<String, Object>> getBasementsByBuildingIds(List<UUID> buildingIds) {
        if (buildingIds == null || buildingIds.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", Collections.nCopies(buildingIds.size(), "?"));
        return jdbcTemplate.queryForList(
            "select * from building_blocks where is_basement_block = true and building_id in (" + placeholders + ") order by created_at asc",
            new ArrayList<>(buildingIds).toArray()
        );
    }

    public void toggleBasementLevel(UUID basementId, int level, boolean isEnabled) {
        if (level < 1 || level > 10) {
            throw new ApiException("level must be integer in range [1..10]", "VALIDATION_ERROR", null, 400);
        }

        Integer depth = jdbcTemplate.query(
            "select basement_depth from building_blocks where id = ? and is_basement_block = true",
            rs -> rs.next() ? rs.getInt("basement_depth") : null,
            basementId
        );

        if (depth == null) {
            throw new ApiException("Basement not found", "NOT_FOUND", null, 404);
        }

        int normalizedDepth = Math.min(10, Math.max(1, depth));
        if (level > normalizedDepth) {
            throw new ApiException("level must be <= basement depth (" + normalizedDepth + ")", "VALIDATION_ERROR", null, 400);
        }

        jdbcTemplate.update(
            """
                update building_blocks
                set basement_parking_levels = jsonb_set(
                    coalesce(basement_parking_levels, '{}'::jsonb),
                    ('{' || ? || '}')::text[],
                    to_jsonb(cast(? as boolean)),
                    true
                ),
                updated_at = now()
                where id = ? and is_basement_block = true
            """,
            String.valueOf(level),
            isEnabled,
            basementId
        );
    }
}
