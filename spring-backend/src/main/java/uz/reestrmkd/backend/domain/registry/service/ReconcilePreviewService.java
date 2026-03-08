package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ReconcilePreviewService {

    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;
    private final EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    private final UnitJpaRepository unitJpaRepository;
    private final CommonAreaJpaRepository commonAreaJpaRepository;

    public ReconcilePreviewService(
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository,
        EntranceMatrixJpaRepository entranceMatrixJpaRepository,
        UnitJpaRepository unitJpaRepository,
        CommonAreaJpaRepository commonAreaJpaRepository
    ) {
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
        this.entranceMatrixJpaRepository = entranceMatrixJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
        this.commonAreaJpaRepository = commonAreaJpaRepository;
    }

    public Map<String, Object> preview(UUID blockId) {
        List<FloorEntity> floors = floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId);
        List<UUID> floorIds = floors.stream().map(FloorEntity::getId).toList();
        if (floorIds.isEmpty()) {
            return Map.of(
                "units", Map.of("toRemove", 0, "checkedCells", 0),
                "commonAreas", Map.of("toRemove", 0, "checkedCells", 0)
            );
        }

        Map<Integer, UUID> entranceByNumber = entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId).stream()
            .collect(Collectors.toMap(EntranceEntity::getNumber, EntranceEntity::getId, (left, right) -> left));

        Map<CellKey, DesiredUnitCounts> desiredUnitsByCell = new HashMap<>();
        Map<CellKey, Integer> desiredMopsByCell = new HashMap<>();
        for (EntranceMatrixEntity row : entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId)) {
            Integer entranceNumber = row.getEntranceNumber();
            UUID entranceId = entranceNumber == null ? null : entranceByNumber.get(entranceNumber);
            if (entranceNumber == null) {
                continue;
            }
            if (entranceNumber != 0 && entranceId == null) {
                continue;
            }
            CellKey key = new CellKey(row.getFloorId(), entranceNumber == 0 ? null : entranceId);
            if (entranceNumber != 0) {
                desiredUnitsByCell.put(
                    key,
                    new DesiredUnitCounts(Math.max(0, nullSafeInt(row.getFlatsCount())), Math.max(0, nullSafeInt(row.getCommercialCount())))
                );
            }
            desiredMopsByCell.put(key, Math.max(0, nullSafeInt(row.getMopCount())));
        }

        Map<CellKey, Integer> flatsByCell = new HashMap<>();
        Map<CellKey, Integer> commercialByCell = new HashMap<>();
        for (UnitEntity unit : unitJpaRepository.findByFloorIdIn(floorIds)) {
            CellKey key = new CellKey(unit.getFloorId(), unit.getEntranceId());
            if (isFlatType(unit.getUnitType())) {
                flatsByCell.put(key, flatsByCell.getOrDefault(key, 0) + 1);
            } else if (isCommercialType(unit.getUnitType())) {
                commercialByCell.put(key, commercialByCell.getOrDefault(key, 0) + 1);
            }
        }

        Set<CellKey> unitKeys = new HashSet<>();
        unitKeys.addAll(flatsByCell.keySet());
        unitKeys.addAll(commercialByCell.keySet());
        int unitsToRemove = 0;
        for (CellKey key : unitKeys) {
            DesiredUnitCounts desired = desiredUnitsByCell.getOrDefault(key, DesiredUnitCounts.ZERO);
            unitsToRemove += Math.max(0, flatsByCell.getOrDefault(key, 0) - desired.flats());
            unitsToRemove += Math.max(0, commercialByCell.getOrDefault(key, 0) - desired.commercial());
        }

        Map<CellKey, Integer> mopsByCell = new HashMap<>();
        for (CommonAreaEntity area : commonAreaJpaRepository.findByFloorIdIn(floorIds)) {
            CellKey key = new CellKey(area.getFloorId(), area.getEntranceId());
            mopsByCell.put(key, mopsByCell.getOrDefault(key, 0) + 1);
        }

        int mopsToRemove = 0;
        for (Map.Entry<CellKey, Integer> entry : mopsByCell.entrySet()) {
            mopsToRemove += Math.max(0, entry.getValue() - desiredMopsByCell.getOrDefault(entry.getKey(), 0));
        }

        return Map.of(
            "units", Map.of("toRemove", unitsToRemove, "checkedCells", unitKeys.size()),
            "commonAreas", Map.of("toRemove", mopsToRemove, "checkedCells", mopsByCell.size())
        );
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

    private record CellKey(UUID floorId, UUID entranceId) {
    }

    private record DesiredUnitCounts(int flats, int commercial) {
        private static final DesiredUnitCounts ZERO = new DesiredUnitCounts(0, 0);
    }
}
