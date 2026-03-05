package uz.reestrmkd.backend.dto;

import java.time.Instant;

public record LockAcquireResponseDto(
    boolean ok,
    String reason,
    String message,
    Instant expiresAt
) {}
