package uz.reestrmkd.backend.domain.registry.api;

public record ValidationErrorItemDto(
    String code,
    String title,
    String message
) {}
