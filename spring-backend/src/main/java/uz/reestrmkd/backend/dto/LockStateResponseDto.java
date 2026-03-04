package uz.reestrmkd.backend.dto;

import uz.reestrmkd.backend.entity.ApplicationLockEntity;

public record LockStateResponseDto(
    ApplicationLockEntity lock
) {}
