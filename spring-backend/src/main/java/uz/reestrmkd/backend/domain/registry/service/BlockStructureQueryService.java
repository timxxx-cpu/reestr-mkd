package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;

import java.util.List;
import java.util.UUID;

@Service
public class BlockStructureQueryService {
    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;

    public BlockStructureQueryService(FloorJpaRepository floorJpaRepository, EntranceJpaRepository entranceJpaRepository) {
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
    }

    public List<FloorEntity> listFloors(UUID blockId) {
        return floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId);
    }

    public List<EntranceEntity> listEntrances(UUID blockId) {
        return entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId);
    }
}
