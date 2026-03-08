package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MopsReconcileService {

    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;
    private final EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    private final CommonAreaJpaRepository commonAreaJpaRepository;

    public MopsReconcileService(
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository,
        EntranceMatrixJpaRepository entranceMatrixJpaRepository,
        CommonAreaJpaRepository commonAreaJpaRepository
    ) {
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
        this.entranceMatrixJpaRepository = entranceMatrixJpaRepository;
        this.commonAreaJpaRepository = commonAreaJpaRepository;
    }

    @Transactional
    public MopsReconcileResult reconcile(UUID blockId) {
        int removed = 0;
        int checkedCells = 0;

        List<FloorEntity> floors = floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId);
        List<UUID> floorIds = floors.stream().map(FloorEntity::getId).toList();
        if (floorIds.isEmpty()) {
            return new MopsReconcileResult(removed, checkedCells);
        }

        Map<Integer, UUID> entranceByNumber = entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId).stream()
            .collect(Collectors.toMap(EntranceEntity::getNumber, EntranceEntity::getId, (left, right) -> left));
        Map<CellKey, Integer> desiredByCell = new HashMap<>();
        for (EntranceMatrixEntity row : entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId)) {
            Integer entranceNumber = row.getEntranceNumber();
            UUID entranceId;
            if (entranceNumber == null) {
                continue;
            } else if (entranceNumber == 0) {
                entranceId = null;
            } else {
                entranceId = entranceByNumber.get(entranceNumber);
                if (entranceId == null) {
                    continue;
                }
            }
            desiredByCell.put(new CellKey(row.getFloorId(), entranceId), Math.max(0, nullSafeInt(row.getMopCount())));
        }

        Map<CellKey, List<CommonAreaEntity>> groupedByCell = new HashMap<>();
        for (CommonAreaEntity area : commonAreaJpaRepository.findByFloorIdIn(floorIds)) {
            groupedByCell.computeIfAbsent(new CellKey(area.getFloorId(), area.getEntranceId()), ignored -> new ArrayList<>()).add(area);
        }

        List<UUID> toDelete = new ArrayList<>();
        for (Map.Entry<CellKey, List<CommonAreaEntity>> entry : groupedByCell.entrySet()) {
            checkedCells++;
            int desired = desiredByCell.getOrDefault(entry.getKey(), 0);
            List<CommonAreaEntity> sorted = new ArrayList<>(entry.getValue());
            sorted.sort(Comparator.comparing(area -> area.getCreatedAt() == null ? Instant.EPOCH : area.getCreatedAt()));
            if (sorted.size() > desired) {
                sorted.subList(desired, sorted.size()).forEach(area -> toDelete.add(area.getId()));
            }
        }

        if (!toDelete.isEmpty()) {
            commonAreaJpaRepository.deleteAllByIdInBatch(toDelete);
            removed = toDelete.size();
        }

        return new MopsReconcileResult(removed, checkedCells);
    }

    private int nullSafeInt(Integer value) {
        return value == null ? 0 : value;
    }

    public record MopsReconcileResult(int removed, int checkedCells) {
    }

    private record CellKey(UUID floorId, UUID entranceId) {
    }
}
