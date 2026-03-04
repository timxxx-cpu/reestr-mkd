package uz.reestrmkd.backend.dto;

public record IntegrationStatusUpdateRequestDto(
    String field,
    String status
) {}
