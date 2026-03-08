package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EntranceMatrixQueryService {

    private final EntranceMatrixJpaRepository entranceMatrixJpaRepository;

    public EntranceMatrixQueryService(EntranceMatrixJpaRepository entranceMatrixJpaRepository) {
        this.entranceMatrixJpaRepository = entranceMatrixJpaRepository;
    }

    public List<Map<String, Object>> listByBlock(UUID blockId) {
        return entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId).stream()
            .map(this::toMap)
            .toList();
    }

    private Map<String, Object> toMap(EntranceMatrixEntity entity) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", entity.getId());
        row.put("block_id", entity.getBlockId());
        row.put("floor_id", entity.getFloorId());
        row.put("entrance_number", entity.getEntranceNumber());
        row.put("flats_count", entity.getFlatsCount());
        row.put("commercial_count", entity.getCommercialCount());
        row.put("mop_count", entity.getMopCount());
        row.put("created_at", entity.getCreatedAt());
        row.put("updated_at", entity.getUpdatedAt());
        return row;
    }
}
