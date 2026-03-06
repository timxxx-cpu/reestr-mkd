package uz.reestrmkd.backend.domain.registry.api;

import java.util.List;
import java.util.Map;

public record UpdateFloorsBatchRequestDto(
    List<Map<String, Object>> items,
    Boolean strict
) {
    public List<Map<String, Object>> safeItems() {
        return items == null ? List.of() : items;
    }

    public boolean safeStrict() {
        return strict != null && strict;
    }
}
