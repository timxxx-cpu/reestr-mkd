package uz.reestrmkd.backend.controller;

import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.LockAcquireRequestDto;
import uz.reestrmkd.backend.dto.LockAcquireResponseDto;
import uz.reestrmkd.backend.dto.LockStateResponseDto;
import uz.reestrmkd.backend.dto.OkResponseDto;
import uz.reestrmkd.backend.entity.ApplicationLockEntity;
import uz.reestrmkd.backend.entity.ApplicationEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.ApplicationLockJpaRepository;
import uz.reestrmkd.backend.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.time.Instant;
import java.util.UUID;
import java.util.Objects;

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
    public LockStateResponseDto get(@PathVariable UUID applicationId) {
        var lock = lockRepo.findByApplicationId(applicationId).orElse(null);
        return new LockStateResponseDto(lock);
    }

    @PostMapping("/acquire")
    public LockAcquireResponseDto acquire(@PathVariable UUID applicationId, @Valid @RequestBody(required = false) LockAcquireRequestDto body) {
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
            
            // saveAndFlush заставляет Hibernate немедленно отправить запрос в базу
            lock = lockRepo.saveAndFlush(lock);
            return new LockAcquireResponseDto(true, lock);
            
        } catch (DataIntegrityViolationException e) {
            // ПЕРЕХВАТ ОШИБКИ ОТ REACT STRICT MODE
            // Если запрос дублируется, второй упадет тут. Проверяем базу еще раз:
            var existing = lockRepo.findByApplicationId(applicationId).orElse(null);
            if (existing != null && Objects.equals(existing.getOwnerUserId(), userId)) {
                // Если блокировка создана нами же долю секунды назад — всё отлично! Возвращаем её.
                return new LockAcquireResponseDto(true, existing);
            }
            // А если это реально другой человек, отдаем честную ошибку
            throw new ApiException("Заявка уже открыта другим пользователем. Попробуйте позже.", "LOCKED", null, 409);
        }
    }

    @PostMapping("/refresh")
    public LockAcquireResponseDto refresh(@PathVariable UUID applicationId, @Valid @RequestBody(required = false) LockAcquireRequestDto body) {
        ActorPrincipal actor = resolveActor();
        String userId = actor.userId();
        
        var existing = lockRepo.findByApplicationId(applicationId).orElse(null);
        if (existing == null) {
            throw new ApiException("Lock not found", "NOT_FOUND", null, 404);
        }
        if (!Objects.equals(existing.getOwnerUserId(), userId)) {
            throw new ApiException("Lock owner mismatch", "OWNER_MISMATCH", null, 403);
        }
        
        int ttl = body == null || body.ttlSeconds() == null ? 1200 : body.ttlSeconds();
        existing.setExpiresAt(Instant.now().plusSeconds(Math.max(60, ttl)));
        existing.setUpdatedAt(Instant.now());
        lockRepo.save(existing);
        return new LockAcquireResponseDto(true, existing);
    }

    @PostMapping("/release")
    public OkResponseDto release(@PathVariable UUID applicationId) {
        ActorPrincipal actor = resolveActor();
        String userId = actor.userId();
        
        var existing = lockRepo.findByApplicationId(applicationId).orElse(null);
        if (existing != null && Objects.equals(userId, existing.getOwnerUserId())) {
            lockRepo.delete(existing);
        }
        return new OkResponseDto(true);
    }
}