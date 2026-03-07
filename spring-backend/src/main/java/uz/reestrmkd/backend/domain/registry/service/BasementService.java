package uz.reestrmkd.backend.domain.registry.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.exception.ApiException;

import java.nio.charset.StandardCharsets;
import java.sql.Array;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class BasementService {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
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

        if (!isEnabled) {
            jdbcTemplate.update(
                """
                    delete from units u
                    using floors f
                    where u.floor_id = f.id
                      and f.block_id = ?
                      and f."index" = ?
                      and u.unit_type = 'parking_place'
                """,
                basementId,
                -level
            );
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapBasementRow(Map<String, Object> row) {
        List<String> blocks = parseLinkedBlockIds(row.get("linked_block_ids"));
        Map<String, Object> parkingLevels = parseObjectMap(row.get("basement_parking_levels"));
        Map<String, Object> communications = parseObjectMap(row.get("basement_communications"));

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

        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", String.valueOf(row.get("id")));
        mapped.put("buildingId", String.valueOf(row.get("building_id")));
        mapped.put("blockId", blocks.isEmpty() ? null : blocks.get(0));
        mapped.put("blocks", blocks);
        mapped.put("depth", row.get("basement_depth") == null ? 1 : ((Number) row.get("basement_depth")).intValue());
        mapped.put("hasParking", Boolean.TRUE.equals(row.get("basement_has_parking")));
        mapped.put("parkingLevels", parkingLevels);
        mapped.put("communications", communications);
        mapped.put("entrancesCount", Math.min(10, Math.max(1, entrancesCount)));
        return mapped;
    }

    private List<String> parseLinkedBlockIds(Object linkedIdsRaw) {
        List<String> blocks = new ArrayList<>();
        if (linkedIdsRaw == null) {
            return blocks;
        }

        if (linkedIdsRaw instanceof Array sqlArray) {
            try {
                Object raw = sqlArray.getArray();
                if (raw instanceof Object[] arr) {
                    for (Object item : arr) {
                        if (item != null) blocks.add(String.valueOf(item));
                    }
                }
                return blocks;
            } catch (Exception ignored) {
                return blocks;
            }
        }

        if (linkedIdsRaw instanceof Object[] arr) {
            for (Object item : arr) {
                if (item != null) blocks.add(String.valueOf(item));
            }
            return blocks;
        }

        if (linkedIdsRaw instanceof List<?> list) {
            for (Object item : list) {
                if (item != null) blocks.add(String.valueOf(item));
            }
            return blocks;
        }

        String raw = String.valueOf(linkedIdsRaw).trim();
        if (raw.startsWith("{") && raw.endsWith("}")) {
            String inner = raw.substring(1, raw.length() - 1).trim();
            if (!inner.isEmpty()) {
                for (String part : inner.split(",")) {
                    String value = part.trim();
                    if (!value.isEmpty() && !"null".equalsIgnoreCase(value)) {
                        blocks.add(value);
                    }
                }
            }
        }
        return blocks;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseObjectMap(Object value) {
        if (value == null) {
            return new HashMap<>();
        }

        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new HashMap<>();
            map.forEach((k, v) -> result.put(String.valueOf(k), v));
            return result;
        }

        String raw = extractJsonOrText(value);
        if (raw == null || raw.isBlank() || "{}".equals(raw)) {
            return new HashMap<>();
        }

        try {
            return OBJECT_MAPPER.readValue(raw.getBytes(StandardCharsets.UTF_8), new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception ignored) {
            return new HashMap<>();
        }
    }

    private String extractJsonOrText(Object value) {
        if (value == null) {
            return null;
        }
        if ("org.postgresql.util.PGobject".equals(value.getClass().getName())) {
            try {
                return String.valueOf(value.getClass().getMethod("getValue").invoke(value));
            } catch (Exception ignored) {
                return String.valueOf(value);
            }
        }
        return String.valueOf(value);
    }
}
