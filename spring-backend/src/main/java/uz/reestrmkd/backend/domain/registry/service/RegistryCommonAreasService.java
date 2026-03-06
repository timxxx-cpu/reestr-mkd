package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RegistryCommonAreasService {
    private final CommonAreasService commonAreasService;

    public RegistryCommonAreasService(CommonAreasService commonAreasService) {
        this.commonAreasService = commonAreasService;
    }

    public void upsert(Map<String, Object> data) {
        commonAreasService.upsert(data);
    }

    public int batchUpsert(List<Map<String, Object>> items) {
        return commonAreasService.batchUpsert(items);
    }

    public void delete(UUID id) {
        commonAreasService.delete(id);
    }

    public void clear(UUID blockId, String floorIds) {
        commonAreasService.clear(blockId, floorIds);
    }

    public List<Map<String, Object>> list(UUID blockId, String floorIds) {
        return commonAreasService.list(blockId, floorIds);
    }
}
