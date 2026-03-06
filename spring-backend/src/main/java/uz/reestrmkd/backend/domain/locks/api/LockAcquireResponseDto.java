package uz.reestrmkd.backend.domain.locks.api;

import java.time.Instant;

public record LockAcquireResponseDto(
    boolean ok,
    String reason,
    String message,
    Instant expiresAt
) {}
