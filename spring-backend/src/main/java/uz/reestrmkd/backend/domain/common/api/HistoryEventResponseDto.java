package uz.reestrmkd.backend.domain.common.api;

import java.util.UUID;

public record HistoryEventResponseDto(
    boolean ok,
    UUID historyEventId
) {}
