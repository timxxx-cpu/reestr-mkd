package uz.reestrmkd.backend.dto;

import java.util.Map;

public record MapPayloadDto(
    Map<String, Object> data
) {}
