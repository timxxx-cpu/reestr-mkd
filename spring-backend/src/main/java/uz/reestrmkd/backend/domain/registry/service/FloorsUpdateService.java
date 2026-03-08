package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FloorsUpdateService {

    private final FloorJpaRepository floorJpaRepository;

    public FloorsUpdateService(FloorJpaRepository floorJpaRepository) {
        this.floorJpaRepository = floorJpaRepository;
    }

    @Transactional
    public Map<String, Object> updateFloor(UUID floorId, Map<String, Object> updates) {
        Map<String, Object> mapped = mapFloorUpdatesToPayload(updates);
        if (mapped.isEmpty()) {
            throw new ApiException("updates are required", "VALIDATION_ERROR", null, 400);
        }

        FloorEntity entity = findFloorById(floorId);
        applyUpdates(entity, mapped, Instant.now());
        return toMap(saveFloor(entity));
    }

    @Transactional
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

        if (toUpdate.isEmpty()) {
            return Map.of("ok", failed.isEmpty(), "updated", 0, "failed", failed);
        }

        List<UUID> floorIds = toUpdate.stream().map(r -> (UUID) r.get("id")).toList();
        Map<UUID, FloorEntity> existingById = findAllFloorsById(floorIds).stream()
            .collect(Collectors.toMap(FloorEntity::getId, entity -> entity));

        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> row : toUpdate) {
            UUID id = (UUID) row.get("id");
            if (!existingById.containsKey(id)) {
                failed.add(Map.of("index", row.get("index"), "id", id.toString(), "reason", "floor not found"));
            } else {
                filtered.add(row);
            }
        }

        if (strict && !failed.isEmpty()) {
            throw new ApiException("One or more floors cannot be updated", "PARTIAL_UPDATE", Map.of("failed", failed), 409);
        }

        Instant now = Instant.now();
        for (Map<String, Object> row : filtered) {
            applyUpdates(existingById.get((UUID) row.get("id")), row, now);
        }

        saveAllFloors(filtered.stream()
            .map(row -> existingById.get((UUID) row.get("id")))
            .filter(Objects::nonNull)
            .toList());

        return Map.of("ok", failed.isEmpty(), "updated", filtered.size(), "failed", failed);
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

    private void applyUpdates(FloorEntity entity, Map<String, Object> mapped, Instant updatedAt) {
        if (mapped.containsKey("label")) entity.setLabel((String) mapped.get("label"));
        if (mapped.containsKey("floor_type")) entity.setFloorType((String) mapped.get("floor_type"));
        if (mapped.containsKey("height")) entity.setHeight((BigDecimal) mapped.get("height"));
        if (mapped.containsKey("area_proj")) entity.setAreaProj((BigDecimal) mapped.get("area_proj"));
        if (mapped.containsKey("area_fact")) entity.setAreaFact((BigDecimal) mapped.get("area_fact"));
        if (mapped.containsKey("is_duplex")) entity.setIsDuplex((Boolean) mapped.get("is_duplex"));
        if (mapped.containsKey("is_technical")) entity.setIsTechnical((Boolean) mapped.get("is_technical"));
        if (mapped.containsKey("is_commercial")) entity.setIsCommercial((Boolean) mapped.get("is_commercial"));
        entity.setUpdatedAt(updatedAt);
    }

    private Map<String, Object> toMap(FloorEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", entity.getId());
        row.put("block_id", entity.getBlockId());
        row.put("extension_id", entity.getExtensionId());
        row.put("floor_key", entity.getFloorKey());
        row.put("label", entity.getLabel());
        row.put("floor_type", entity.getFloorType());
        row.put("index", entity.getIndex());
        row.put("height", entity.getHeight());
        row.put("area_proj", entity.getAreaProj());
        row.put("area_fact", entity.getAreaFact());
        row.put("is_duplex", entity.getIsDuplex());
        row.put("parent_floor_index", entity.getParentFloorIndex());
        row.put("basement_id", entity.getBasementId());
        row.put("is_technical", entity.getIsTechnical());
        row.put("is_commercial", entity.getIsCommercial());
        row.put("is_stylobate", entity.getIsStylobate());
        row.put("is_basement", entity.getIsBasement());
        row.put("is_attic", entity.getIsAttic());
        row.put("is_loft", entity.getIsLoft());
        row.put("is_roof", entity.getIsRoof());
        row.put("created_at", entity.getCreatedAt());
        row.put("updated_at", entity.getUpdatedAt());
        return row;
    }

    private FloorEntity findFloorById(UUID floorId) {
        if (floorId == null) {
            throw new ApiException("floorId is required", "VALIDATION_ERROR", null, 400);
        }
        return floorJpaRepository.findById(floorId)
            .orElseThrow(() -> new ApiException("Floor not found", "NOT_FOUND", null, 404));
    }

    private List<FloorEntity> findAllFloorsById(List<UUID> floorIds) {
        return floorJpaRepository.findAllById(new ArrayList<>(floorIds));
    }

    private FloorEntity saveFloor(FloorEntity entity) {
        if (entity == null) {
            throw new ApiException("floor entity is required", "VALIDATION_ERROR", null, 400);
        }
        return floorJpaRepository.save(entity);
    }

    private void saveAllFloors(List<FloorEntity> entities) {
        floorJpaRepository.saveAll(new ArrayList<>(entities));
    }
}
