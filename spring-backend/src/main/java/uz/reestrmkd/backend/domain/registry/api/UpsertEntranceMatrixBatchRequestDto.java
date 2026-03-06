package uz.reestrmkd.backend.domain.registry.api;

import java.util.List;
import java.util.Map;

public record UpsertEntranceMatrixBatchRequestDto(
    List<Map<String, Object>> cells
) {
    public List<Map<String, Object>> safeCells() {
        return cells == null ? List.of() : cells;
    }
}
