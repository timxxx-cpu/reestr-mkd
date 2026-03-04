package uz.reestrmkd.backend.controller;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.LockAcquireRequestDto;
import uz.reestrmkd.backend.dto.LockAcquireResponseDto;
import uz.reestrmkd.backend.dto.LockStateResponseDto;
import uz.reestrmkd.backend.dto.OkResponseDto;
import uz.reestrmkd.backend.entity.ApplicationLockEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.ApplicationLockJpaRepository;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}/locks")
public class LocksController {
    private final ApplicationLockJpaRepository lockRepo;

    public LocksController(ApplicationLockJpaRepository lockRepo) { this.lockRepo = lockRepo; }

    @GetMapping
    public LockStateResponseDto get(@PathVariable UUID applicationId) {
        var lock = lockRepo.findByApplicationId(applicationId).orElse(null);
        return new LockStateResponseDto(lock);
    }

    @PostMapping("/acquire")
    public LockAcquireResponseDto acquire(@PathVariable UUID applicationId, @RequestHeader(value = "x-user-id", required = false) String userId, @Valid @RequestBody(required = false) LockAcquireRequestDto body) {
        int ttl = body == null || body.ttlSeconds() == null ? 1200 : body.ttlSeconds();
        var existing = lockRepo.findByApplicationId(applicationId).orElse(null);
        if (existing != null && existing.getExpiresAt() != null && existing.getExpiresAt().isAfter(Instant.now()) && !String.valueOf(existing.getOwnerUserId()).equals(userId)) {
            throw new ApiException("Lock already held", "LOCK_CONFLICT", null, 409);
        }
        ApplicationLockEntity lock = existing == null ? new ApplicationLockEntity() : existing;
        if (lock.getId() == null) lock.setId(UUID.randomUUID());
        lock.setApplicationId(applicationId);
        lock.setOwnerUserId(userId);
        lock.setOwnerRole(null);
        lock.setAcquiredAt(Instant.now());
        lock.setExpiresAt(Instant.now().plusSeconds(Math.max(60, ttl)));
        lock.setUpdatedAt(Instant.now());
        lockRepo.save(lock);
        return new LockAcquireResponseDto(true, lock);
    }

    @PostMapping("/refresh")
    public LockAcquireResponseDto refresh(@PathVariable UUID applicationId, @RequestHeader(value = "x-user-id", required = false) String userId, @Valid @RequestBody(required = false) LockAcquireRequestDto body) {
        return acquire(applicationId, userId, body);
    }

    @PostMapping("/release")
    public OkResponseDto release(@PathVariable UUID applicationId, @RequestHeader(value = "x-user-id", required = false) String userId) {
        var existing = lockRepo.findByApplicationId(applicationId).orElse(null);
        if (existing != null && (userId == null || userId.equals(existing.getOwnerUserId()))) {
            lockRepo.delete(existing);
        }
        return new OkResponseDto(true);
    }
}
