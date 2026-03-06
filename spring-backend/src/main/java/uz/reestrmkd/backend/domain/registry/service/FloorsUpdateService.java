package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.exception.ApiException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FloorsUpdateService {

    private final JdbcTemplate jdbcTemplate;

    public FloorsUpdateService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> updateFloor(UUID floorId, Map<String, Object> updates) {
        Map<String, Object> mapped = mapFloorUpdatesToPayload(updates);
        if (mapped.isEmpty()) {
            throw new ApiException("updates are required", "VALIDATION_ERROR", null, 400);
        }

        int affected = jdbcTemplate.update(
            "update floors set label=coalesce(?,label), floor_type=coalesce(?,floor_type), height=coalesce(?,height), area_proj=coalesce(?,area_proj), area_fact=coalesce(?,area_fact), is_duplex=coalesce(?,is_duplex), is_technical=coalesce(?,is_technical), is_commercial=coalesce(?,is_commercial), updated_at=now() where id=?",
            mapped.get("label"),
            mapped.get("floor_type"),
            mapped.get("height"),
            mapped.get("area_proj"),
            mapped.get("area_fact"),
            mapped.get("is_duplex"),
            mapped.get("is_technical"),
            mapped.get("is_commercial"),
            floorId
        );
        if (affected == 0) {
            throw new ApiException("Floor not found", "NOT_FOUND", null, 404);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("select * from floors where id=?", floorId);
        return rows.getFirst();
    }

    public Map<String, Object> updateFloorsBatch(List<Map<String, Object>> items, boolean strict) {
        if (items.isEmpty()) {
            return Map.of("ok", true, "updated", 0, "failed", List.of());
        }

        List<Map<String, Object>> failed = new ArrayList<>();
        List<Map<String, Object>> toUpdate = new ArrayList<>();

        for (int index = 0; index < items.size(); index++) {
            Map<String, Object> item = items.get(index);
            UUID floorId = parseUuid(item.get("id"));
            if (floorId == null) {
                failed.add(Map.of("index", index, "reason", "id is required"));
                continue;
            }
            Map<String, Object> mapped = mapFloorUpdatesToPayload(asMap(item.get("updates")));
            if (mapped.isEmpty()) {
                failed.add(Map.of("index", index, "id", floorId.toString(), "reason", "updates are required"));
                continue;
            }
            Map<String, Object> row = new HashMap<>(mapped);
            row.put("id", floorId);
            row.put("index", index);
            toUpdate.add(row);
        }

        if (!toUpdate.isEmpty()) {
            List<UUID> floorIds = toUpdate.stream().map(r -> (UUID) r.get("id")).toList();
            String in = String.join(",", Collections.nCopies(floorIds.size(), "?"));
            List<Map<String, Object>> existing = jdbcTemplate.queryForList("select id from floors where id in (" + in + ")", floorIds.toArray());
            Set<UUID> existingIds = existing.stream().map(r -> UUID.fromString(String.valueOf(r.get("id")))).collect(Collectors.toSet());

            List<Map<String, Object>> filtered = new ArrayList<>();
            for (Map<String, Object> row : toUpdate) {
                UUID id = (UUID) row.get("id");
                if (!existingIds.contains(id)) {
                    failed.add(Map.of("index", row.get("index"), "id", id.toString(), "reason", "floor not found"));
                } else {
                    filtered.add(row);
                }
            }

            if (strict && !failed.isEmpty()) {
                throw new ApiException("One or more floors cannot be updated", "PARTIAL_UPDATE", Map.of("failed", failed), 409);
            }

            for (Map<String, Object> row : filtered) {
                jdbcTemplate.update(
                    "update floors set label=coalesce(?,label), floor_type=coalesce(?,floor_type), height=coalesce(?,height), area_proj=coalesce(?,area_proj), area_fact=coalesce(?,area_fact), is_duplex=coalesce(?,is_duplex), is_technical=coalesce(?,is_technical), is_commercial=coalesce(?,is_commercial), updated_at=now() where id=?",
                    row.get("label"),
                    row.get("floor_type"),
                    row.get("height"),
                    row.get("area_proj"),
                    row.get("area_fact"),
                    row.get("is_duplex"),
                    row.get("is_technical"),
                    row.get("is_commercial"),
                    row.get("id")
                );
            }

            return Map.of("ok", failed.isEmpty(), "updated", filtered.size(), "failed", failed);
        }

        return Map.of("ok", failed.isEmpty(), "updated", 0, "failed", failed);
    }

    private Map<String, Object> mapFloorUpdatesToPayload(Map<String, Object> updates) {
        Map<String, Object> payload = new HashMap<>();
        if (updates.containsKey("label")) payload.put("label", updates.get("label"));
        if (updates.containsKey("floorType")) payload.put("floor_type", updates.get("floorType"));
        if (updates.containsKey("height")) payload.put("height", parseNullableDecimal(updates.get("height"), "height"));
        if (updates.containsKey("areaProj")) payload.put("area_proj", parseNullableDecimal(updates.get("areaProj"), "areaProj"));
        if (updates.containsKey("areaFact")) payload.put("area_fact", parseNullableDecimal(updates.get("areaFact"), "areaFact"));
        if (updates.containsKey("isDuplex")) payload.put("is_duplex", updates.get("isDuplex"));
        if (updates.containsKey("isTechnical")) payload.put("is_technical", updates.get("isTechnical"));
        if (updates.containsKey("isCommercial")) payload.put("is_commercial", updates.get("isCommercial"));
        return payload;
    }

    private BigDecimal parseNullableDecimal(Object value, String fieldName) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException ex) {
            throw new ApiException(fieldName + " must be a number", "VALIDATION_ERROR", null, 400);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private UUID parseUuid(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
