package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EntranceMatrixService {

    private final JdbcTemplate jdbcTemplate;

    public EntranceMatrixService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> upsertCell(UUID blockId, Map<String, Object> body) {
        UUID floorId = parseUuid(body.get("floorId"));
        Integer entranceNumber = toNullableInt(body.get("entranceNumber"));
        if (floorId == null || entranceNumber == null) {
            throw new ApiException("floorId and entranceNumber are required", "VALIDATION_ERROR", null, 400);
        }

        MatrixValues values = validateValues(asMap(body.get("values")));

        jdbcTemplate.update(
            "insert into entrance_matrix(id,block_id,floor_id,entrance_number,flats_count,commercial_count,mop_count,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,now()) on conflict (block_id,floor_id,entrance_number) do update set flats_count=excluded.flats_count, commercial_count=excluded.commercial_count, mop_count=excluded.mop_count, updated_at=now()",
            blockId,
            floorId,
            entranceNumber,
            values.flatsCount,
            values.commercialCount,
            values.mopCount
        );

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "select * from entrance_matrix where block_id=? and floor_id=? and entrance_number=? limit 1",
            blockId,
            floorId,
            entranceNumber
        );
        return rows.isEmpty() ? Map.of("ok", true) : rows.getFirst();
    }

    public Map<String, Object> upsertBatch(UUID blockId, List<Map<String, Object>> cells) {
        if (cells == null || cells.isEmpty()) {
            return Map.of("ok", true, "updated", 0, "failed", List.of());
        }

        List<Map<String, Object>> failed = new ArrayList<>();
        List<Map<String, Object>> valid = new ArrayList<>();

        for (int index = 0; index < cells.size(); index++) {
            Map<String, Object> cell = cells.get(index);
            UUID floorId = parseUuid(cell.get("floorId"));
            Integer entranceNumber = toNullableInt(cell.get("entranceNumber"));
            if (floorId == null || entranceNumber == null) {
                failed.add(Map.of("index", index, "reason", "floorId and entranceNumber are required"));
                continue;
            }
            try {
                MatrixValues validated = validateValues(asMap(cell.get("values")));
                Map<String, Object> validRow = new HashMap<>();
                validRow.put("floorId", floorId);
                validRow.put("entranceNumber", entranceNumber);
                validRow.put("flatsCount", validated.flatsCount);
                validRow.put("commercialCount", validated.commercialCount);
                validRow.put("mopCount", validated.mopCount);
                valid.add(validRow);
            } catch (ApiException ex) {
                Map<String, Object> failRow = new HashMap<>();
                failRow.put("index", index);
                failRow.put("floorId", floorId.toString());
                failRow.put("entranceNumber", entranceNumber);
                failRow.put("reason", ex.getMessage());
                failed.add(failRow);
            }
        }

        for (Map<String, Object> row : valid) {
            jdbcTemplate.update(
                "insert into entrance_matrix(id,block_id,floor_id,entrance_number,flats_count,commercial_count,mop_count,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,now()) on conflict (block_id,floor_id,entrance_number) do update set flats_count=excluded.flats_count, commercial_count=excluded.commercial_count, mop_count=excluded.mop_count, updated_at=now()",
                blockId,
                row.get("floorId"),
                row.get("entranceNumber"),
                row.get("flatsCount"),
                row.get("commercialCount"),
                row.get("mopCount")
            );
        }

        return Map.of("ok", true, "updated", valid.size(), "failed", failed);
    }

    private MatrixValues validateValues(Map<String, Object> values) {
        Integer flatsCount = parseNonNegativeIntOrNull(values.get("flatsCount"));
        Integer commercialCount = parseNonNegativeIntOrNull(values.get("commercialCount"));
        Integer mopCount = parseNonNegativeIntOrNull(values.get("mopCount"));
        if (flatsCount == null && commercialCount == null && mopCount == null) {
            throw new ApiException("At least one matrix value is required", "VALIDATION_ERROR", null, 400);
        }
        return new MatrixValues(flatsCount, commercialCount, mopCount);
    }

    private Integer parseNonNegativeIntOrNull(Object value) {
        if (value == null) return null;
        Integer parsed = toNullableInt(value);
        if (parsed == null) {
            throw new ApiException("Matrix values must be integers", "VALIDATION_ERROR", null, 400);
        }
        if (parsed < 0) {
            throw new ApiException("Matrix values must be non-negative", "VALIDATION_ERROR", null, 400);
        }
        return parsed;
    }

    private UUID parseUuid(Object value) {
        if (value == null) return null;
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    private Integer toNullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private record MatrixValues(Integer flatsCount, Integer commercialCount, Integer mopCount) {
    }
}
