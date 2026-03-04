package uz.reestrmkd.backend.dto;

import java.util.UUID;

public record HistoryEventResponseDto(
    boolean ok,
    UUID historyEventId
) {}
