package uz.reestrmkd.backend.domain.common.api;

import com.fasterxml.jackson.annotation.JsonValue;

import java.util.List;

public record ItemsResponseDto(
    List<?> items
) {
    @JsonValue
    public List<?> value() {
        return items;
    }
}
