package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UnitsReconcileService {

    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;
    private final EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    private final UnitJpaRepository unitJpaRepository;

    public UnitsReconcileService(
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository,
        EntranceMatrixJpaRepository entranceMatrixJpaRepository,
        UnitJpaRepository unitJpaRepository
    ) {
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
        this.entranceMatrixJpaRepository = entranceMatrixJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
    }

    @Transactional
    public UnitsReconcileResult reconcile(UUID blockId) {
        int removed = 0;
        int added = 0;
        int checkedCells = 0;

        List<FloorEntity> floors = floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId);
        List<UUID> floorIds = floors.stream().map(FloorEntity::getId).toList();
        if (floorIds.isEmpty()) {
            return new UnitsReconcileResult(removed, added, checkedCells);
        }

        Map<Integer, UUID> entranceByNumber = entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId).stream()
            .collect(Collectors.toMap(EntranceEntity::getNumber, EntranceEntity::getId, (left, right) -> left));

        Map<CellKey, DesiredUnitCounts> desiredByCell = new HashMap<>();
        for (EntranceMatrixEntity row : entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId)) {
            UUID entranceId = entranceByNumber.get(row.getEntranceNumber());
            if (entranceId == null) {
                continue;
            }
            desiredByCell.put(
                new CellKey(row.getFloorId(), entranceId),
                new DesiredUnitCounts(Math.max(0, nullSafeInt(row.getFlatsCount())), Math.max(0, nullSafeInt(row.getCommercialCount())))
            );
        }

        Map<CellKey, List<UnitEntity>> flatsByCell = new HashMap<>();
        Map<CellKey, List<UnitEntity>> commercialByCell = new HashMap<>();
        for (UnitEntity unit : unitJpaRepository.findByFloorIdIn(floorIds)) {
            CellKey key = new CellKey(unit.getFloorId(), unit.getEntranceId());
            if (isFlatType(unit.getUnitType())) {
                flatsByCell.computeIfAbsent(key, ignored -> new ArrayList<>()).add(unit);
            } else if (isCommercialType(unit.getUnitType())) {
                commercialByCell.computeIfAbsent(key, ignored -> new ArrayList<>()).add(unit);
            }
        }

        Set<CellKey> keys = new HashSet<>(desiredByCell.keySet());
        keys.addAll(flatsByCell.keySet());
        keys.addAll(commercialByCell.keySet());

        Comparator<UnitEntity> preserveRichDataComparator = Comparator
            .comparing((UnitEntity unit) -> hasCadastreNumber(unit) ? 0 : 1)
            .thenComparing(unit -> hasAreaData(unit) ? 0 : 1)
            .thenComparing(unit -> unit.getCreatedAt() == null ? Instant.EPOCH : unit.getCreatedAt());

        List<UUID> unitIdsToDelete = new ArrayList<>();
        List<UnitEntity> unitsToCreate = new ArrayList<>();
        Instant now = Instant.now();

        for (CellKey key : keys) {
            checkedCells++;
            DesiredUnitCounts desired = desiredByCell.getOrDefault(key, DesiredUnitCounts.ZERO);

            List<UnitEntity> flats = new ArrayList<>(flatsByCell.getOrDefault(key, List.of()));
            List<UnitEntity> commercial = new ArrayList<>(commercialByCell.getOrDefault(key, List.of()));
            flats.sort(preserveRichDataComparator);
            commercial.sort(preserveRichDataComparator);

            reconcileCellUnits(flats, desired.flats(), "flat", key, now, unitIdsToDelete, unitsToCreate);
            reconcileCellUnits(commercial, desired.commercial(), "office", key, now, unitIdsToDelete, unitsToCreate);
        }

        if (!unitIdsToDelete.isEmpty()) {
            unitJpaRepository.deleteAllByIdInBatch(unitIdsToDelete);
            removed = unitIdsToDelete.size();
        }

        if (!unitsToCreate.isEmpty()) {
            unitJpaRepository.saveAll(unitsToCreate);
            added = unitsToCreate.size();
        }

        return new UnitsReconcileResult(removed, added, checkedCells);
    }

    private void reconcileCellUnits(
        List<UnitEntity> existing,
        int desiredCount,
        String unitType,
        CellKey key,
        Instant now,
        List<UUID> unitIdsToDelete,
        List<UnitEntity> unitsToCreate
    ) {
        if (existing.size() > desiredCount) {
            existing.subList(desiredCount, existing.size()).forEach(unit -> unitIdsToDelete.add(unit.getId()));
        } else if (existing.size() < desiredCount) {
            for (int i = existing.size(); i < desiredCount; i++) {
                UnitEntity unit = new UnitEntity();
                unit.setId(UUID.randomUUID());
                unit.setFloorId(key.floorId());
                unit.setEntranceId(key.entranceId());
                unit.setUnitType(unitType);
                unit.setStatus("free");
                unit.setHasMezzanine(Boolean.FALSE);
                unit.setCreatedAt(now);
                unit.setUpdatedAt(now);
                unitsToCreate.add(unit);
            }
        }
    }

    private int nullSafeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private boolean isFlatType(String type) {
        return "flat".equalsIgnoreCase(type) || "apartment".equalsIgnoreCase(type);
    }

    private boolean isCommercialType(String type) {
        return "office".equalsIgnoreCase(type) || "commercial".equalsIgnoreCase(type);
    }

    private boolean hasCadastreNumber(UnitEntity unit) {
        return unit.getCadastreNumber() != null && !unit.getCadastreNumber().isBlank();
    }

    private boolean hasAreaData(UnitEntity unit) {
        return unit.getTotalArea() != null || unit.getUsefulArea() != null || unit.getLivingArea() != null;
    }

    public record UnitsReconcileResult(int removed, int added, int checkedCells) {
    }

    private record CellKey(UUID floorId, UUID entranceId) {
    }

    private record DesiredUnitCounts(int flats, int commercial) {
        private static final DesiredUnitCounts ZERO = new DesiredUnitCounts(0, 0);
    }
}
