package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.annotation.JsonCreator;

import java.util.LinkedHashMap;
import java.util.Map;

public record MapPayloadDto(
    Map<String, Object> data
) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static MapPayloadDto from(Map<String, Object> payload) {
        if (payload == null) {
            return new MapPayloadDto(Map.of());
        }

        Object nestedData = payload.get("data");
        if (payload.size() == 1 && nestedData instanceof Map<?, ?> map) {
            Map<String, Object> unwrapped = new LinkedHashMap<>();
            map.forEach((key, value) -> unwrapped.put(String.valueOf(key), value));
            return new MapPayloadDto(unwrapped);
        }

        return new MapPayloadDto(payload);
    }
}
