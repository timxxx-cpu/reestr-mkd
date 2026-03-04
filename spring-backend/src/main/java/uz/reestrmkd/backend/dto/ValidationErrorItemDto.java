package uz.reestrmkd.backend.dto;

public record ValidationErrorItemDto(
    String code,
    String title,
    String message
) {}
