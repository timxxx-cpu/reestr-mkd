package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EntranceReconcileService {

    private final EntranceJpaRepository entranceJpaRepository;

    public EntranceReconcileService(EntranceJpaRepository entranceJpaRepository) {
        this.entranceJpaRepository = entranceJpaRepository;
    }

    @Transactional
    public EntranceReconcileResult reconcile(UUID blockId, int count) {
        int normalizedCount = Math.max(0, count);

        List<EntranceEntity> existing = entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId);
        Set<Integer> present = existing.stream()
            .map(entrance -> entrance.getNumber() == null ? 0 : entrance.getNumber())
            .collect(Collectors.toSet());

        int created = 0;
        List<EntranceEntity> toCreate = new ArrayList<>();
        Instant now = Instant.now();
        for (int i = 1; i <= normalizedCount; i++) {
            if (!present.contains(i)) {
                EntranceEntity entrance = new EntranceEntity();
                entrance.setId(UUID.randomUUID());
                entrance.setBlockId(blockId);
                entrance.setNumber(i);
                entrance.setCreatedAt(now);
                entrance.setUpdatedAt(now);
                toCreate.add(entrance);
                created += 1;
            }
        }

        if (!toCreate.isEmpty()) {
            entranceJpaRepository.saveAll(toCreate);
        }

        List<UUID> deleteIds = existing.stream()
            .filter(entrance -> entrance.getNumber() != null && entrance.getNumber() > normalizedCount)
            .map(EntranceEntity::getId)
            .toList();

        if (!deleteIds.isEmpty()) {
            entranceJpaRepository.deleteAllByIdInBatch(deleteIds);
        }

        return new EntranceReconcileResult(normalizedCount, created, deleteIds.size());
    }

    public record EntranceReconcileResult(int count, int created, int deleted) {
    }
}
