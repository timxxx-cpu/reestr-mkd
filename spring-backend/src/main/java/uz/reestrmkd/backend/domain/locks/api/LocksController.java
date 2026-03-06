package uz.reestrmkd.backend.domain.locks.api;

import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationLockEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationLockJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import org.springframework.lang.NonNull;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}/locks")
public class LocksController {
    private final ApplicationLockJpaRepository lockRepo;
    private final ApplicationJpaRepository applicationRepo;

    public LocksController(ApplicationLockJpaRepository lockRepo, ApplicationJpaRepository applicationRepo) {
        this.lockRepo = lockRepo;
        this.applicationRepo = applicationRepo;
    }

    private ActorPrincipal resolveActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof ActorPrincipal actor) return actor;
        throw new ApiException("Unauthorized", "UNAUTHORIZED", null, 401);
    }

    @GetMapping
    public LockStateResponseDto get(@PathVariable @NonNull UUID applicationId) {
        var lock = lockRepo.findByApplicationId(applicationId).orElse(null);
        if (lock == null) {
            return new LockStateResponseDto(false, null, null, null);
        }
        return new LockStateResponseDto(true, lock.getOwnerUserId(), lock.getOwnerRole(), lock.getExpiresAt());
    }

    @PostMapping("/acquire")
    public LockAcquireResponseDto acquire(@PathVariable @NonNull UUID applicationId, @Valid @RequestBody(required = false) LockAcquireRequestDto body) {
        ActorPrincipal actor = resolveActor();
        String userId = actor.userId();
        String role = actor.userRole();

        ApplicationEntity app = applicationRepo.findById(applicationId)
            .orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));

        if ("technician".equals(role) && app.getAssigneeName() != null && !app.getAssigneeName().equals(userId)) {
            throw new ApiException("Заявка назначена на " + app.getAssigneeName() + ". Взять в работу нельзя.", "ASSIGNEE_MISMATCH", null, 403);
        }

        int ttl = body == null || body.ttlSeconds() == null ? 1200 : body.ttlSeconds();

        try {
            var existing = lockRepo.findByApplicationId(applicationId).orElse(null);

            if (existing != null && existing.getExpiresAt() != null && existing.getExpiresAt().isAfter(Instant.now()) && !Objects.equals(existing.getOwnerUserId(), userId)) {
                throw new ApiException("Заявка уже открыта пользователем " + existing.getOwnerUserId() + ". Попробуйте позже.", "LOCKED", null, 409);
            }

            ApplicationLockEntity lock = existing == null ? new ApplicationLockEntity() : existing;
            lock.setApplicationId(applicationId);
            lock.setOwnerUserId(userId);
            lock.setOwnerRole(role);
            lock.setAcquiredAt(Instant.now());
            lock.setExpiresAt(Instant.now().plusSeconds(Math.max(60, ttl)));
            lock.setUpdatedAt(Instant.now());

            lock = lockRepo.saveAndFlush(lock);
            return new LockAcquireResponseDto(true, "ACQUIRED", "Lock acquired", lock.getExpiresAt());

        } catch (DataIntegrityViolationException e) {
            var existing = lockRepo.findByApplicationId(applicationId).orElse(null);
            if (existing != null && Objects.equals(existing.getOwnerUserId(), userId)) {
                return new LockAcquireResponseDto(true, "ACQUIRED", "Lock acquired", existing.getExpiresAt());
            }
            throw new ApiException("Заявка уже открыта другим пользователем. Попробуйте позже.", "LOCKED", null, 409);
        }
    }

    @PostMapping("/refresh")
    public LockAcquireResponseDto refresh(@PathVariable @NonNull UUID applicationId, @Valid @RequestBody(required = false) LockAcquireRequestDto body) {
        ActorPrincipal actor = resolveActor();
        String userId = actor.userId();

        var existing = lockRepo.findByApplicationId(applicationId).orElse(null);
        if (existing == null) {
            throw new ApiException("Lock not found", "NOT_FOUND", null, 404);
        }
        if (!Objects.equals(existing.getOwnerUserId(), userId)) {
            throw new ApiException("Lock owner mismatch", "OWNER_MISMATCH", null, 409);
        }

        int ttl = body == null || body.ttlSeconds() == null ? 1200 : body.ttlSeconds();
        existing.setExpiresAt(Instant.now().plusSeconds(Math.max(60, ttl)));
        existing.setUpdatedAt(Instant.now());
        lockRepo.save(existing);
        return new LockAcquireResponseDto(true, "REFRESHED", "Lock refreshed", existing.getExpiresAt());
    }

    @PostMapping("/release")
    public LockAcquireResponseDto release(@PathVariable @NonNull UUID applicationId) {
        ActorPrincipal actor = resolveActor();
        String userId = actor.userId();

        var existing = lockRepo.findByApplicationId(applicationId).orElse(null);
        if (existing == null) {
            throw new ApiException("Lock not found", "NOT_FOUND", null, 404);
        }
        if (!Objects.equals(userId, existing.getOwnerUserId())) {
            throw new ApiException("Lock owner mismatch", "OWNER_MISMATCH", null, 409);
        }

        lockRepo.delete(existing);
        return new LockAcquireResponseDto(true, "RELEASED", "Lock released", null);
    }
}
