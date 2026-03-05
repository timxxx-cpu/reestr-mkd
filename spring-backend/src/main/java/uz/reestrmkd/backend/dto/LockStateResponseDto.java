package uz.reestrmkd.backend.dto;

import java.time.Instant;

public record LockStateResponseDto(
    boolean locked,
    String ownerUserId,
    String ownerRole,
    Instant expiresAt
) {}
