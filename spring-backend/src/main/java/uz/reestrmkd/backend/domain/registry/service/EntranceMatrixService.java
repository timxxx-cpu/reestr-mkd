package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EntranceMatrixService {

    private final EntranceMatrixJpaRepository entranceMatrixJpaRepository;

    public EntranceMatrixService(EntranceMatrixJpaRepository entranceMatrixJpaRepository) {
        this.entranceMatrixJpaRepository = entranceMatrixJpaRepository;
    }

    @Transactional
    public Map<String, Object> upsertCell(UUID blockId, Map<String, Object> body) {
        UUID floorId = parseUuid(body.get("floorId"));
        Integer entranceNumber = toNullableInt(body.get("entranceNumber"));
        if (floorId == null || entranceNumber == null) {
            throw new ApiException("floorId and entranceNumber are required", "VALIDATION_ERROR", null, 400);
        }

        MatrixValues values = validateValues(asMap(body.get("values")));
        Instant now = Instant.now();
        EntranceMatrixEntity entity = entranceMatrixJpaRepository
            .findByBlockIdAndFloorIdAndEntranceNumber(blockId, floorId, entranceNumber)
            .orElseGet(EntranceMatrixEntity::new);

        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setCreatedAt(now);
            entity.setBlockId(blockId);
            entity.setFloorId(floorId);
            entity.setEntranceNumber(entranceNumber);
        }

        entity.setFlatsCount(values.flatsCount);
        entity.setCommercialCount(values.commercialCount);
        entity.setMopCount(values.mopCount);
        entity.setUpdatedAt(now);

        return toMap(entranceMatrixJpaRepository.save(entity));
    }

    @Transactional
    public Map<String, Object> upsertBatch(UUID blockId, List<Map<String, Object>> cells) {
        if (cells == null || cells.isEmpty()) {
            return Map.of("ok", true, "updated", 0, "failed", List.of());
        }

        List<Map<String, Object>> failed = new ArrayList<>();
        List<EntranceMatrixEntity> valid = new ArrayList<>();
        Instant now = Instant.now();

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
                EntranceMatrixEntity entity = entranceMatrixJpaRepository
                    .findByBlockIdAndFloorIdAndEntranceNumber(blockId, floorId, entranceNumber)
                    .orElseGet(EntranceMatrixEntity::new);
                if (entity.getId() == null) {
                    entity.setId(UUID.randomUUID());
                    entity.setCreatedAt(now);
                    entity.setBlockId(blockId);
                    entity.setFloorId(floorId);
                    entity.setEntranceNumber(entranceNumber);
                }
                entity.setFlatsCount(validated.flatsCount);
                entity.setCommercialCount(validated.commercialCount);
                entity.setMopCount(validated.mopCount);
                entity.setUpdatedAt(now);
                valid.add(entity);
            } catch (ApiException ex) {
                Map<String, Object> failRow = new HashMap<>();
                failRow.put("index", index);
                failRow.put("floorId", floorId.toString());
                failRow.put("entranceNumber", entranceNumber);
                failRow.put("reason", ex.getMessage());
                failed.add(failRow);
            }
        }

        if (!valid.isEmpty()) {
            entranceMatrixJpaRepository.saveAll(valid);
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

    private Map<String, Object> toMap(EntranceMatrixEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", entity.getId());
        row.put("block_id", entity.getBlockId());
        row.put("floor_id", entity.getFloorId());
        row.put("entrance_number", entity.getEntranceNumber());
        row.put("flats_count", entity.getFlatsCount());
        row.put("commercial_count", entity.getCommercialCount());
        row.put("mop_count", entity.getMopCount());
        row.put("created_at", entity.getCreatedAt());
        row.put("updated_at", entity.getUpdatedAt());
        return row;
    }

    private record MatrixValues(Integer flatsCount, Integer commercialCount, Integer mopCount) {
    }
}
