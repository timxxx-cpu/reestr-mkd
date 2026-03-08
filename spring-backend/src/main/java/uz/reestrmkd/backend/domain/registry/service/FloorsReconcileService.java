package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FloorsReconcileService {

    private final BuildingBlockJpaRepository blockRepo;
    private final BuildingJpaRepository buildingRepo;
    private final BlockFloorMarkerJpaRepository markerRepo;
    private final FloorJpaRepository floorRepo;
    private final UnitJpaRepository unitRepo;
    private final CommonAreaJpaRepository commonAreaRepo;
    private final EntranceMatrixJpaRepository entranceMatrixRepo;
    private final FloorGeneratorService floorGeneratorService;

    public FloorsReconcileService(
        BuildingBlockJpaRepository blockRepo,
        BuildingJpaRepository buildingRepo,
        BlockFloorMarkerJpaRepository markerRepo,
        FloorJpaRepository floorRepo,
        UnitJpaRepository unitRepo,
        CommonAreaJpaRepository commonAreaRepo,
        EntranceMatrixJpaRepository entranceMatrixRepo,
        FloorGeneratorService floorGeneratorService
    ) {
        this.blockRepo = blockRepo;
        this.buildingRepo = buildingRepo;
        this.markerRepo = markerRepo;
        this.floorRepo = floorRepo;
        this.unitRepo = unitRepo;
        this.commonAreaRepo = commonAreaRepo;
        this.entranceMatrixRepo = entranceMatrixRepo;
        this.floorGeneratorService = floorGeneratorService;
    }

    @Transactional
    public FloorsReconcileResult reconcile(UUID blockId) {
        if (blockId == null) {
            throw new ApiException("blockId is required", "VALIDATION_ERROR", null, 400);
        }
        BuildingBlockEntity block = blockRepo.findById(blockId)
            .orElseThrow(() -> new ApiException("Block not found", "NOT_FOUND", null, 404));
        BuildingEntity building = buildingRepo.findById(Objects.requireNonNull(block.getBuildingId()))
            .orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        List<BuildingBlockEntity> allBlocks = blockRepo.findByBuildingId(block.getBuildingId());
        List<BlockFloorMarkerEntity> markers = markerRepo.findByBlockIdIn(List.of(blockId));

        List<FloorEntity> existingFloors = floorRepo.findByBlockIdOrderByIndexAsc(blockId);
        List<Map<String, Object>> generated = floorGeneratorService.generateFloorsModel(block, building, allBlocks, markers);
        Set<String> seenKeys = new HashSet<>();
        List<Map<String, Object>> targetModel = generated.stream().filter(floor -> seenKeys.add(floorConstraintKey(floor))).toList();

        Map<String, FloorEntity> existingByKey = existingFloors.stream()
            .collect(Collectors.toMap(this::floorConstraintKey, row -> row, (a, b) -> a));

        Set<UUID> usedExistingIds = new HashSet<>();
        List<FloorEntity> toUpsert = new ArrayList<>();
        Instant now = Instant.now();

        for (Map<String, Object> floor : targetModel) {
            String cKey = floorConstraintKey(floor);
            FloorEntity existing = existingByKey.get(cKey);
            FloorEntity floorEntity = existing == null ? new FloorEntity() : existing;
            if (existing != null && existing.getId() != null) {
                usedExistingIds.add(existing.getId());
            }
            applyFloorPayload(floorEntity, floor, blockId, now);
            toUpsert.add(floorEntity);
        }

        List<FloorEntity> toDelete = existingFloors.stream()
            .filter(floor -> floor.getId() != null && !usedExistingIds.contains(floor.getId()))
            .toList();

        if (!toUpsert.isEmpty()) {
            floorRepo.saveAll(toUpsert);
        }

        if (!toDelete.isEmpty()) {
            Map<UUID, UUID> floorRemap = buildFloorRemap(toDelete, toUpsert);
            remapFloorReferences(floorRemap, now);
            floorRepo.deleteAllByIdInBatch(
                toDelete.stream()
                    .map(FloorEntity::getId)
                    .filter(Objects::nonNull)
                    .toList()
            );
        }

        return new FloorsReconcileResult(toDelete.size(), toUpsert.size());
    }

    private Map<UUID, UUID> buildFloorRemap(List<FloorEntity> removedFloors, List<FloorEntity> targetFloors) {
        Map<UUID, UUID> remap = new HashMap<>();
        for (FloorEntity removedFloor : removedFloors) {
            UUID oldFloorId = removedFloor.getId();
            if (oldFloorId == null) {
                continue;
            }
            int oldIdx = defaultInt(removedFloor.getIndex(), 0);
            UUID candidate = targetFloors.stream()
                .filter(row -> row.getId() != null)
                .min(Comparator.comparingInt(row -> Math.abs(defaultInt(row.getIndex(), 0) - oldIdx)))
                .map(FloorEntity::getId)
                .orElse(null);
            if (candidate != null && !candidate.equals(oldFloorId)) {
                remap.put(oldFloorId, candidate);
            }
        }
        return remap;
    }

    private void remapFloorReferences(Map<UUID, UUID> floorRemap, Instant updatedAt) {
        for (Map.Entry<UUID, UUID> entry : floorRemap.entrySet()) {
            unitRepo.remapFloorId(entry.getKey(), entry.getValue(), updatedAt);
            commonAreaRepo.remapFloorId(entry.getKey(), entry.getValue(), updatedAt);
            entranceMatrixRepo.remapFloorId(entry.getKey(), entry.getValue(), updatedAt);
        }
    }

    private void applyFloorPayload(FloorEntity entity, Map<String, Object> floor, UUID blockId, Instant now) {
        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
        }
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(now);
        }
        entity.setBlockId(getUuid(floor.get("block_id"), blockId));
        entity.setIndex(getInteger(floor.get("index")));
        entity.setFloorKey(getString(floor.get("floor_key")));
        entity.setLabel(getString(floor.get("label")));
        entity.setFloorType(getString(floor.get("floor_type")));
        entity.setHeight(getBigDecimal(floor.get("height")));
        entity.setAreaProj(getBigDecimal(floor.get("area_proj")));
        entity.setIsTechnical(getBoolean(floor.get("is_technical"), false));
        entity.setIsCommercial(getBoolean(floor.get("is_commercial"), false));
        entity.setIsStylobate(getBoolean(floor.get("is_stylobate"), false));
        entity.setIsBasement(getBoolean(floor.get("is_basement"), false));
        entity.setIsAttic(getBoolean(floor.get("is_attic"), false));
        entity.setIsLoft(getBoolean(floor.get("is_loft"), false));
        entity.setIsRoof(getBoolean(floor.get("is_roof"), false));
        entity.setParentFloorIndex(getInteger(floor.get("parent_floor_index")));
        entity.setBasementId(getUuid(floor.get("basement_id"), null));
        entity.setUpdatedAt(now);
    }

    private String floorConstraintKey(FloorEntity floor) {
        int index = defaultInt(floor.getIndex(), 0);
        int parent = floor.getParentFloorIndex() == null ? -99999 : defaultInt(floor.getParentFloorIndex(), -99999);
        String basementId = floor.getBasementId() == null ? "none" : String.valueOf(floor.getBasementId());
        return index + "|" + parent + "|" + basementId;
    }

    private String floorConstraintKey(Map<String, Object> floor) {
        int index = getInteger(floor.get("index"), 0);
        int parent = floor.get("parent_floor_index") == null ? -99999 : getInteger(floor.get("parent_floor_index"), -99999);
        String basementId = floor.get("basement_id") == null ? "none" : String.valueOf(floor.get("basement_id"));
        return index + "|" + parent + "|" + basementId;
    }

    private Integer getInteger(Object value) {
        return value == null ? null : getInteger(value, null);
    }

    private Integer getInteger(Object value, Integer fallback) {
        if (value == null) return fallback;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            return fallback;
        }
    }

    private int defaultInt(Integer value, int fallback) {
        return value == null ? fallback : value;
    }

    private UUID getUuid(Object value, UUID fallback) {
        if (value == null) {
            return fallback;
        }
        if (value instanceof UUID uuid) {
            return uuid;
        }
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (Exception ex) {
            return fallback;
        }
    }

    private String getString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Boolean getBoolean(Object value, boolean fallback) {
        if (value == null) {
            return fallback;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private BigDecimal getBigDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    public record FloorsReconcileResult(int deleted, int upserted) {
    }
}
