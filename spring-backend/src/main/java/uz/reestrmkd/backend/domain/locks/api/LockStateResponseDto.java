package uz.reestrmkd.backend.domain.locks.api;

import java.time.Instant;

public record LockStateResponseDto(
    boolean locked,
    String ownerUserId,
    String ownerRole,
    Instant expiresAt
) {}
