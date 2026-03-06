package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.exception.ApiException;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CommonAreasService {

    private final JdbcTemplate jdbcTemplate;

    public CommonAreasService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void upsert(Map<String, Object> data) {
        UUID floorId = parseRequiredUuid(data.get("floorId"), "floorId");
        UUID entranceId = parseRequiredUuid(data.get("entranceId"), "entranceId");
        BigDecimal area = parseRequiredDecimal(data.get("area"), "area");
        BigDecimal height = parseRequiredDecimal(data.get("height"), "height");
        String type = String.valueOf(data.getOrDefault("type", "")).trim();
        if (type.isBlank()) {
            throw new ApiException("type is required", "VALIDATION_ERROR", null, 400);
        }

        UUID persistedId = parsePersistedUuid(data.get("id"));
        if (persistedId == null) {
            jdbcTemplate.update(
                "insert into common_areas(id,floor_id,entrance_id,type,area,height,updated_at,created_at) values (gen_random_uuid(),?,?,?,?,?,now(),now())",
                floorId, entranceId, type, area, height
            );
        } else {
            jdbcTemplate.update(
                "update common_areas set floor_id=?, entrance_id=?, type=?, area=?, height=?, updated_at=now() where id=?",
                floorId, entranceId, type, area, height, persistedId
            );
        }
    }

    public int batchUpsert(List<Map<String, Object>> items) {
        for (Map<String, Object> item : items) {
            upsert(item);
        }
        return items.size();
    }

    public void delete(UUID id) {
        jdbcTemplate.update("delete from common_areas where id=?", id);
    }

    public void clear(UUID blockId, String floorIds) {
        if (floorIds == null || floorIds.isBlank()) {
            jdbcTemplate.update("delete from common_areas where floor_id in (select id from floors where block_id=?)", blockId);
            return;
        }
        for (String f : floorIds.split(",")) {
            jdbcTemplate.update("delete from common_areas where floor_id=?", UUID.fromString(f.trim()));
        }
    }

    public List<Map<String, Object>> list(UUID blockId, String floorIds) {
        if (floorIds == null || floorIds.isBlank()) {
            return jdbcTemplate.queryForList("select ca.* from common_areas ca join floors f on f.id=ca.floor_id where f.block_id=?", blockId);
        }
        List<String> arr = Arrays.stream(floorIds.split(",")).map(String::trim).toList();
        String in = String.join(",", Collections.nCopies(arr.size(), "?"));
        return jdbcTemplate.queryForList("select * from common_areas where floor_id in (" + in + ")", arr.toArray());
    }

    private UUID parsePersistedUuid(Object rawId) {
        if (rawId == null) {
            return null;
        }
        String value = String.valueOf(rawId).trim();
        if (value.isBlank() || value.startsWith("temp-")) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            throw new ApiException("Invalid id format: " + value, "VALIDATION_ERROR", null, 400);
        }
    }

    private UUID parseRequiredUuid(Object value, String fieldName) {
        if (value == null) {
            throw new ApiException(fieldName + " is required", "VALIDATION_ERROR", null, 400);
        }
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException ex) {
            throw new ApiException(fieldName + " must be UUID", "VALIDATION_ERROR", null, 400);
        }
    }

    private BigDecimal parseRequiredDecimal(Object value, String fieldName) {
        if (value == null) {
            throw new ApiException(fieldName + " is required", "VALIDATION_ERROR", null, 400);
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (Exception ex) {
            throw new ApiException(fieldName + " must be number", "VALIDATION_ERROR", null, 400);
        }
    }
}
