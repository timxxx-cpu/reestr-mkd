package uz.reestrmkd.backend.domain.common.api;

public record SummaryCountsResponseDto(
    int total,
    int inProgress,
    int completed,
    int declined
) {}
