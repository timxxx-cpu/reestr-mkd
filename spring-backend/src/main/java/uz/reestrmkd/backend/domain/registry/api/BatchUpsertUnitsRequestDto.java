package uz.reestrmkd.backend.domain.registry.api;

import java.util.List;
import java.util.Map;

public record BatchUpsertUnitsRequestDto(
    List<Map<String, Object>> unitsList,
    List<Map<String, Object>> items
) {
    public List<Map<String, Object>> resolveItems() {
        if (unitsList != null) return unitsList;
        if (items != null) return items;
        return List.of();
    }
}
