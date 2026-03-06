package uz.reestrmkd.backend.domain.registry.api;

import java.util.List;
import java.util.Map;

public record BatchUpsertCommonAreasRequestDto(
    List<Map<String, Object>> items,
    List<Map<String, Object>> mops
) {
    public List<Map<String, Object>> resolveItems() {
        if (items != null) return items;
        if (mops != null) return mops;
        return List.of();
    }
}
