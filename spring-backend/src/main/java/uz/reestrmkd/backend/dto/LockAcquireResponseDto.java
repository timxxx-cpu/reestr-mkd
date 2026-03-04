package uz.reestrmkd.backend.dto;

import uz.reestrmkd.backend.entity.ApplicationLockEntity;

public record LockAcquireResponseDto(
    boolean ok,
    ApplicationLockEntity lock
) {}
