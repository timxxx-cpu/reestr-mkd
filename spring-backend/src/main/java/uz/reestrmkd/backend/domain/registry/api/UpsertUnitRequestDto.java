package uz.reestrmkd.backend.domain.registry.api;

import java.util.Map;

public record UpsertUnitRequestDto(
    Map<String, Object> data
) {
    public Map<String, Object> safeData() {
        return data == null ? Map.of() : data;
    }
}
