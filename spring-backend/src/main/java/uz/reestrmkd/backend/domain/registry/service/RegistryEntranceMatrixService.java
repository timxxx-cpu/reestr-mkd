package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RegistryEntranceMatrixService {
    private final EntranceMatrixService entranceMatrixService;
    private final EntranceMatrixQueryService entranceMatrixQueryService;

    public RegistryEntranceMatrixService(
        EntranceMatrixService entranceMatrixService,
        EntranceMatrixQueryService entranceMatrixQueryService
    ) {
        this.entranceMatrixService = entranceMatrixService;
        this.entranceMatrixQueryService = entranceMatrixQueryService;
    }

    public List<Map<String, Object>> listByBlock(UUID blockId) {
        return entranceMatrixQueryService.listByBlock(blockId);
    }

    public Map<String, Object> upsertCell(UUID blockId, Map<String, Object> body) {
        return entranceMatrixService.upsertCell(blockId, body);
    }

    public Map<String, Object> upsertBatch(UUID blockId, List<Map<String, Object>> cells) {
        return entranceMatrixService.upsertBatch(blockId, cells);
    }
}
