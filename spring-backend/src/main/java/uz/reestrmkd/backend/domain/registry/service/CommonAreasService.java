package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CommonAreasService {

    private final CommonAreaJpaRepository commonAreaJpaRepository;
    private final FloorJpaRepository floorJpaRepository;

    public CommonAreasService(CommonAreaJpaRepository commonAreaJpaRepository, FloorJpaRepository floorJpaRepository) {
        this.commonAreaJpaRepository = commonAreaJpaRepository;
        this.floorJpaRepository = floorJpaRepository;
    }

    @Transactional
    public void upsert(Map<String, Object> data) {
        UUID floorId = parseRequiredUuid(data.get("floorId"), "floorId");
        UUID entranceId = parseNullableUuid(data.get("entranceId"), "entranceId");
        BigDecimal area = parseRequiredDecimal(data.get("area"), "area");
        BigDecimal height = parseRequiredDecimal(data.get("height"), "height");
        String type = String.valueOf(data.getOrDefault("type", "")).trim();
        if (type.isBlank()) {
            throw new ApiException("type is required", "VALIDATION_ERROR", null, 400);
        }

        UUID persistedId = parsePersistedUuid(data.get("id"));
        Instant now = Instant.now();
        CommonAreaEntity entity = persistedId == null
            ? new CommonAreaEntity()
            : commonAreaJpaRepository.findById(persistedId).orElseGet(CommonAreaEntity::new);

        if (entity.getId() == null) {
            entity.setId(persistedId != null ? persistedId : UUID.randomUUID());
            entity.setCreatedAt(now);
        }

        entity.setFloorId(floorId);
        entity.setEntranceId(entranceId);
        entity.setType(type);
        entity.setArea(area);
        entity.setHeight(height);
        entity.setUpdatedAt(now);

        commonAreaJpaRepository.save(entity);
    }

    @Transactional
    public int batchUpsert(List<Map<String, Object>> items) {
        for (Map<String, Object> item : items) {
            upsert(item);
        }
        return items.size();
    }

    @Transactional
    public void delete(UUID id) {
        if (id == null) {
            throw new ApiException("id is required", "VALIDATION_ERROR", null, 400);
        }
        commonAreaJpaRepository.deleteById(id);
    }

    @Transactional
    public void clear(UUID blockId, String floorIds) {
        List<UUID> ids = floorIds == null || floorIds.isBlank()
            ? floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId).stream().map(FloorEntity::getId).toList()
            : parseFloorIds(floorIds);
        if (ids.isEmpty()) {
            return;
        }
        commonAreaJpaRepository.deleteByFloorIdIn(ids);
    }

    public List<Map<String, Object>> list(UUID blockId, String floorIds) {
        List<UUID> ids = floorIds == null || floorIds.isBlank()
            ? floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId).stream().map(FloorEntity::getId).toList()
            : parseFloorIds(floorIds);
        if (ids.isEmpty()) {
            return List.of();
        }
        return commonAreaJpaRepository.findByFloorIdIn(ids).stream()
            .map(this::toMap)
            .toList();
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

    private UUID parseNullableUuid(Object value, String fieldName) {
        if (value == null) {
            return null;
        }
        String raw = String.valueOf(value).trim();
        if (raw.isBlank() || "null".equalsIgnoreCase(raw)) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(fieldName + " must be UUID", "VALIDATION_ERROR", null, 400);
        }
    }

    private List<UUID> parseFloorIds(String floorIds) {
        return Arrays.stream(floorIds.split(","))
            .map(String::trim)
            .filter(v -> !v.isBlank())
            .map(value -> {
                try {
                    return UUID.fromString(value);
                } catch (IllegalArgumentException ex) {
                    throw new ApiException("floorIds contains invalid UUID: " + value, "VALIDATION_ERROR", null, 400);
                }
            })
            .toList();
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

    private Map<String, Object> toMap(CommonAreaEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", entity.getId());
        row.put("floor_id", entity.getFloorId());
        row.put("entrance_id", entity.getEntranceId());
        row.put("type", entity.getType());
        row.put("area", entity.getArea());
        row.put("height", entity.getHeight());
        row.put("created_at", entity.getCreatedAt());
        row.put("updated_at", entity.getUpdatedAt());
        return row;
    }

}
