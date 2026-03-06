package uz.reestrmkd.backend.domain.registry.api;

import java.util.Map;

public record UpdateFloorRequestDto(
    Map<String, Object> updates
) {
    public Map<String, Object> safeUpdates() {
        return updates == null ? Map.of() : updates;
    }
}
