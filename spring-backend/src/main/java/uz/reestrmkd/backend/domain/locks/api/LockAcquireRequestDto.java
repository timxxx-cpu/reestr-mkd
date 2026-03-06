package uz.reestrmkd.backend.domain.locks.api;

public record LockAcquireRequestDto(
    Integer ttlSeconds
) {}
