package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.common.service.UjIdentifierService;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitType;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class ParkingSyncService {

    private final UnitJpaRepository unitJpaRepository;
    private final FloorJpaRepository floorJpaRepository;
    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final BuildingJpaRepository buildingJpaRepository;
    private final ProjectJpaRepository projectJpaRepository;
    private final UjIdentifierService ujIdentifierService;

    public ParkingSyncService(
        UnitJpaRepository unitJpaRepository,
        FloorJpaRepository floorJpaRepository,
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        BuildingJpaRepository buildingJpaRepository,
        ProjectJpaRepository projectJpaRepository,
        UjIdentifierService ujIdentifierService
    ) {
        this.unitJpaRepository = unitJpaRepository;
        this.floorJpaRepository = floorJpaRepository;
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.buildingJpaRepository = buildingJpaRepository;
        this.projectJpaRepository = projectJpaRepository;
        this.ujIdentifierService = ujIdentifierService;
    }

    public ParkingSyncResult syncParkingPlaces(UUID floorId, int targetCount) {
        int normalizedTargetCount = Math.max(0, targetCount);
        List<UnitEntity> existing = unitJpaRepository.findByFloorIdAndUnitTypeOrderByCreatedAtAscIdAsc(
            floorId,
            UnitType.PARKING_PLACE.value()
        );
        List<UnitEntity> missingCodes = existing.stream()
            .filter(unit -> isBlank(asNullableString(unit.getUnitCode())))
            .toList();

        int current = existing.size();
        int removed = 0;
        int added = 0;
        ParkingCodeContext codeContext = null;

        if (current < normalizedTargetCount || !missingCodes.isEmpty()) {
            codeContext = loadParkingCodeContext(floorId);
            backfillMissingParkingCodes(missingCodes, codeContext);
        }

        if (current == normalizedTargetCount) {
            return new ParkingSyncResult(added, removed);
        }

        if (current < normalizedTargetCount) {
            ParkingCodeContext requiredCodeContext = codeContext != null ? codeContext : loadParkingCodeContext(floorId);
            List<UnitEntity> newUnits = new ArrayList<>();
            for (int i = 0; i < (normalizedTargetCount - current); i++) {
                UnitEntity unit = new UnitEntity();
                unit.setId(UUID.randomUUID());
                unit.setFloorId(floorId);
                unit.setNumber(null);
                unit.setUnitType(UnitType.PARKING_PLACE.value());
                unit.setTotalArea(null);
                unit.setStatus("free");
                unit.setHasMezzanine(Boolean.FALSE);
                unit.setUnitCode(requiredCodeContext.nextCode(ujIdentifierService));
                unit.setCreatedAt(requiredCodeContext.now());
                unit.setUpdatedAt(requiredCodeContext.now());
                newUnits.add(unit);
            }
            unitJpaRepository.saveAll(newUnits);
            added = newUnits.size();
            return new ParkingSyncResult(added, removed);
        }

        List<UnitEntity> sorted = new ArrayList<>(existing);
        sorted.sort((left, right) -> Integer.compare(toInt(right.getNumber(), 0), toInt(left.getNumber(), 0)));
        List<UnitEntity> toDelete = new ArrayList<>(sorted.subList(0, current - normalizedTargetCount));
        unitJpaRepository.deleteAllInBatch(toDelete);
        removed = toDelete.size();

        return new ParkingSyncResult(added, removed);
    }

    private void backfillMissingParkingCodes(List<UnitEntity> rows, ParkingCodeContext codeContext) {
        if (rows.isEmpty()) {
            return;
        }
        for (UnitEntity row : rows) {
            row.setUnitCode(codeContext.nextCode(ujIdentifierService));
            row.setUpdatedAt(codeContext.now());
        }
        unitJpaRepository.saveAll(rows);
    }

    private ParkingCodeContext loadParkingCodeContext(UUID floorId) {
        FloorEntity floor = findFloorById(floorId)
            .orElseThrow(() -> new ApiException("Floor not found", "NOT_FOUND", null, 404));
        BuildingBlockEntity block = findBlockById(floor.getBlockId())
            .orElseThrow(() -> new ApiException("Building block not found", "NOT_FOUND", null, 404));
        BuildingEntity building = findBuildingById(block.getBuildingId())
            .orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        ProjectEntity project = findProjectById(building.getProjectId())
            .orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));

        UUID buildingId = building.getId();
        String buildingCode = asNullableString(building.getBuildingCode());
        String ujCode = asNullableString(project.getUjCode());

        String basePrefix = ujIdentifierService.getUnitPrefix("parking_place");
        String fullPrefix = buildFullUnitPrefix(ujCode, buildingCode, basePrefix);

        List<String> existingCodes = findUnitCodeRows(buildingId).stream()
            .map(UnitJpaRepository.BuildingUnitCodeRow::getUnitCode)
            .filter(code -> code != null && !code.isBlank())
            .toList();

        int nextSequence = ujIdentifierService.getNextSequenceNumber(
            existingCodes == null ? Collections.emptyList() : existingCodes,
            fullPrefix
        );

        return new ParkingCodeContext(fullPrefix, nextSequence);
    }

    private String buildFullUnitPrefix(String ujCode, String buildingCode, String unitPrefix) {
        if (!isBlank(buildingCode)) {
            if (!isBlank(ujCode) && buildingCode.startsWith(ujCode)) {
                return buildingCode + "-" + unitPrefix;
            }
            return (isBlank(ujCode) ? "" : ujCode + "-") + buildingCode + "-" + unitPrefix;
        }
        return (isBlank(ujCode) ? "" : ujCode + "-") + unitPrefix;
    }

    private String asNullableString(Object value) {
        if (value == null) return null;
        String raw = String.valueOf(value).trim();
        return raw.isBlank() ? null : raw;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private int toInt(Object value, Integer fallback) {
        if (value == null) return fallback;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            return fallback;
        }
    }

    private java.util.Optional<FloorEntity> findFloorById(UUID floorId) {
        if (floorId == null) {
            return java.util.Optional.empty();
        }
        return floorJpaRepository.findById(floorId);
    }

    private java.util.Optional<BuildingBlockEntity> findBlockById(UUID blockId) {
        if (blockId == null) {
            return java.util.Optional.empty();
        }
        return buildingBlockJpaRepository.findById(blockId);
    }

    private java.util.Optional<BuildingEntity> findBuildingById(UUID buildingId) {
        if (buildingId == null) {
            return java.util.Optional.empty();
        }
        return buildingJpaRepository.findById(buildingId);
    }

    private java.util.Optional<ProjectEntity> findProjectById(UUID projectId) {
        if (projectId == null) {
            return java.util.Optional.empty();
        }
        return projectJpaRepository.findById(projectId);
    }

    private List<UnitJpaRepository.BuildingUnitCodeRow> findUnitCodeRows(UUID buildingId) {
        if (buildingId == null) {
            return List.of();
        }
        return unitJpaRepository.findUnitCodesByBuildingIds(List.of(buildingId));
    }

    public record ParkingSyncResult(int added, int removed) {
    }

    private static final class ParkingCodeContext {
        private final String fullPrefix;
        private int nextSequence;
        private final java.time.Instant now;

        private ParkingCodeContext(String fullPrefix, int nextSequence) {
            this.fullPrefix = fullPrefix;
            this.nextSequence = nextSequence;
            this.now = java.time.Instant.now();
        }

        private String nextCode(UjIdentifierService service) {
            String code = service.generateUnitCode(fullPrefix, nextSequence);
            nextSequence += 1;
            return code;
        }

        private java.time.Instant now() {
            return now;
        }
    }
}
