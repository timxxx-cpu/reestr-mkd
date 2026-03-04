package uz.reestrmkd.backend.dto;

public record RequestDeclineRequestDto(
    String reason,
    Integer stepIndex
) {}
