package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
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
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            """
                select bb.id, bb.building_id, bb.linked_block_ids, bb.basement_depth,
                       bb.basement_has_parking, bb.basement_parking_levels,
                       bb.basement_communications, bb.entrances_count
                from building_blocks bb
                join buildings b on b.id = bb.building_id
                where b.project_id = ? and bb.is_basement_block = true
                order by bb.created_at asc
            """,
            projectId
        );
        return rows.stream().map(this::mapBasementRow).toList();
    }

    public List<Map<String, Object>> getBasementsByBuildingIds(List<UUID> buildingIds) {
        if (buildingIds == null || buildingIds.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", Collections.nCopies(buildingIds.size(), "?"));
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "select id, building_id, linked_block_ids, basement_depth, basement_has_parking, basement_parking_levels, basement_communications, entrances_count from building_blocks where is_basement_block = true and building_id in (" + placeholders + ") order by created_at asc",
            new ArrayList<>(buildingIds).toArray()
        );
        return rows.stream().map(this::mapBasementRow).toList();
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

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapBasementRow(Map<String, Object> row) {
        Object linkedIdsRaw = row.get("linked_block_ids");
        List<String> blocks = new ArrayList<>();
        if (linkedIdsRaw instanceof Object[] arr) {
            for (Object item : arr) {
                if (item != null) blocks.add(String.valueOf(item));
            }
        } else if (linkedIdsRaw instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) blocks.add(String.valueOf(item));
            }
        }

        Object levelsRaw = row.get("basement_parking_levels");
        Map<String, Object> parkingLevels = levelsRaw instanceof Map<?, ?>
            ? new HashMap<>((Map<String, Object>) levelsRaw)
            : new HashMap<>();

        Object commRaw = row.get("basement_communications");
        Map<String, Object> communications = commRaw instanceof Map<?, ?>
            ? new HashMap<>((Map<String, Object>) commRaw)
            : new HashMap<>();

        int entrancesCount = 1;
        Object entrancesRaw = row.get("entrances_count");
        if (entrancesRaw instanceof Number n) {
            entrancesCount = n.intValue();
        } else if (entrancesRaw != null) {
            try {
                entrancesCount = Integer.parseInt(String.valueOf(entrancesRaw));
            } catch (Exception ignored) {
                entrancesCount = 1;
            }
        }

        return Map.of(
            "id", String.valueOf(row.get("id")),
            "buildingId", String.valueOf(row.get("building_id")),
            "blockId", blocks.isEmpty() ? null : blocks.get(0),
            "blocks", blocks,
            "depth", row.get("basement_depth") == null ? 1 : ((Number) row.get("basement_depth")).intValue(),
            "hasParking", Boolean.TRUE.equals(row.get("basement_has_parking")),
            "parkingLevels", parkingLevels,
            "communications", communications,
            "entrancesCount", Math.min(10, Math.max(1, entrancesCount))
        );
    }
}
