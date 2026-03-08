package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;

@Service
public class BasementService {
    private final BuildingJpaRepository buildingJpaRepository;
    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final FloorJpaRepository floorJpaRepository;
    private final UnitJpaRepository unitJpaRepository;

    public BasementService(
        BuildingJpaRepository buildingJpaRepository,
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        FloorJpaRepository floorJpaRepository,
        UnitJpaRepository unitJpaRepository
    ) {
        this.buildingJpaRepository = buildingJpaRepository;
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.floorJpaRepository = floorJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
    }

    public List<Map<String, Object>> getProjectBasements(UUID projectId) {
        List<UUID> buildingIds = buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
            .map(BuildingEntity::getId)
            .toList();
        return getBasementsByBuildingIds(buildingIds);
    }

    public List<Map<String, Object>> getBasementsByBuildingIds(List<UUID> buildingIds) {
        if (buildingIds == null || buildingIds.isEmpty()) {
            return List.of();
        }

        return buildingBlockJpaRepository.findByBuildingIdIn(buildingIds).stream()
            .filter(block -> Boolean.TRUE.equals(block.getIsBasementBlock()))
            .sorted(Comparator.comparing(BuildingBlockEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .map(this::mapBasement)
            .toList();
    }

    @Transactional
    public void toggleBasementLevel(UUID basementId, int level, boolean isEnabled) {
        if (level < 1 || level > 10) {
            throw new ApiException("level must be integer in range [1..10]", "VALIDATION_ERROR", null, 400);
        }

        BuildingBlockEntity basement = buildingBlockJpaRepository.findById(basementId)
            .filter(block -> Boolean.TRUE.equals(block.getIsBasementBlock()))
            .orElse(null);
        if (basement == null) {
            throw new ApiException("Basement not found", "NOT_FOUND", null, 404);
        }

        int normalizedDepth = Math.min(10, Math.max(1, basement.getBasementDepth() == null ? 1 : basement.getBasementDepth()));
        if (level > normalizedDepth) {
            throw new ApiException("level must be <= basement depth (" + normalizedDepth + ")", "VALIDATION_ERROR", null, 400);
        }

        Map<String, Object> levels = basement.getBasementParkingLevels() == null
            ? new LinkedHashMap<>()
            : new LinkedHashMap<>(basement.getBasementParkingLevels());
        levels.put(String.valueOf(level), isEnabled);
        basement.setBasementParkingLevels(levels);
        basement.setUpdatedAt(Instant.now());
        buildingBlockJpaRepository.save(basement);

        if (!isEnabled) {
            List<FloorEntity> floors = floorJpaRepository.findByBlockIdAndIndex(basementId, -level);
            for (FloorEntity floor : floors) {
                if (floor.getId() != null) {
                    unitJpaRepository.deleteByFloorIdAndUnitType(floor.getId(), "parking_place");
                }
            }
        }
    }

    private Map<String, Object> mapBasement(BuildingBlockEntity block) {
        List<String> linkedBlocks = block.getLinkedBlockIdsAsList().stream()
            .map(UUID::toString)
            .toList();
        Map<String, Object> parkingLevels = block.getBasementParkingLevels() == null
            ? new HashMap<>()
            : new HashMap<>(block.getBasementParkingLevels());
        Map<String, Object> communications = block.getBasementCommunications() == null
            ? new HashMap<>()
            : new HashMap<>(block.getBasementCommunications());
        int depth = block.getBasementDepth() == null ? 1 : block.getBasementDepth();
        int entrancesCount = block.getEntrancesCount() == null ? 1 : block.getEntrancesCount();

        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", block.getId() == null ? null : String.valueOf(block.getId()));
        mapped.put("buildingId", block.getBuildingId() == null ? null : String.valueOf(block.getBuildingId()));
        mapped.put("blockId", linkedBlocks.isEmpty() ? null : linkedBlocks.getFirst());
        mapped.put("blocks", linkedBlocks);
        mapped.put("depth", depth);
        mapped.put("hasParking", Boolean.TRUE.equals(block.getBasementHasParking()));
        mapped.put("parkingLevels", parkingLevels);
        mapped.put("communications", communications);
        mapped.put("entrancesCount", Math.min(10, Math.max(1, entrancesCount)));
        return mapped;
    }
}
