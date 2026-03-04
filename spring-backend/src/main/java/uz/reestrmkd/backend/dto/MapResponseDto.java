package uz.reestrmkd.backend.dto;

import java.util.Map;

public record MapResponseDto(
    Map<String, Object> data
) {
    public static MapResponseDto of(Map<String, Object> data) {
        return new MapResponseDto(data);
    }
}
