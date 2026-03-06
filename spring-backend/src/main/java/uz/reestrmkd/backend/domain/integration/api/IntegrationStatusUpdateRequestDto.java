package uz.reestrmkd.backend.domain.integration.api;

public record IntegrationStatusUpdateRequestDto(
    String field,
    String status
) {}
