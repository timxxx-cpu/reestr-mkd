package uz.reestrmkd.backend.domain.common.api;

import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Map;

public record MapResponseDto(
    Map<String, Object> data
) {
    @JsonValue
    public Map<String, Object> value() {
        return data;
    }

    public static MapResponseDto of(Map<String, Object> data) {
        return new MapResponseDto(data);
    }
}
