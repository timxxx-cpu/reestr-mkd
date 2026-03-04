package uz.reestrmkd.backend.dto;

public record SummaryCountsResponseDto(
    int total,
    int inProgress,
    int completed,
    int declined
) {}
