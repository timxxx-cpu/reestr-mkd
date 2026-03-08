package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class EntranceMatrixEnsureService {
    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;
    private final EntranceMatrixJpaRepository entranceMatrixJpaRepository;

    public EntranceMatrixEnsureService(
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository,
        EntranceMatrixJpaRepository entranceMatrixJpaRepository
    ) {
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
        this.entranceMatrixJpaRepository = entranceMatrixJpaRepository;
    }

    @Transactional
    public void ensureForBlock(UUID blockId) {
        List<UUID> floorIds = floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId).stream()
            .map(FloorEntity::getId)
            .toList();
        List<Integer> entranceNumbers = entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId).stream()
            .map(EntranceEntity::getNumber)
            .filter(number -> number != null && number > 0)
            .toList();

        if (floorIds.isEmpty() || entranceNumbers.isEmpty()) {
            entranceMatrixJpaRepository.deleteByBlockId(blockId);
            return;
        }

        List<EntranceMatrixEntity> existingRows = entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId);
        Set<UUID> floorSet = new HashSet<>(floorIds);
        Set<Integer> entranceSet = new HashSet<>(entranceNumbers);
        Set<String> existingKeys = new HashSet<>();
        List<UUID> staleIds = new ArrayList<>();

        for (EntranceMatrixEntity row : existingRows) {
            UUID floorId = row.getFloorId();
            Integer entranceNumber = row.getEntranceNumber();
            if (!floorSet.contains(floorId) || entranceNumber == null || !entranceSet.contains(entranceNumber)) {
                staleIds.add(row.getId());
                continue;
            }
            existingKeys.add(key(floorId, entranceNumber));
        }

        if (!staleIds.isEmpty()) {
            entranceMatrixJpaRepository.deleteAllByIdInBatch(staleIds);
        }

        Instant now = Instant.now();
        List<EntranceMatrixEntity> toCreate = new ArrayList<>();
        for (UUID floorId : floorIds) {
            for (Integer entranceNumber : entranceNumbers) {
                String key = key(floorId, entranceNumber);
                if (existingKeys.contains(key)) {
                    continue;
                }
                EntranceMatrixEntity entity = new EntranceMatrixEntity();
                entity.setId(UUID.randomUUID());
                entity.setBlockId(blockId);
                entity.setFloorId(floorId);
                entity.setEntranceNumber(entranceNumber);
                entity.setCreatedAt(now);
                entity.setUpdatedAt(now);
                toCreate.add(entity);
            }
        }

        if (!toCreate.isEmpty()) {
            entranceMatrixJpaRepository.saveAll(toCreate);
        }
    }

    private String key(UUID floorId, Integer entranceNumber) {
        return floorId + "|" + entranceNumber;
    }
}
