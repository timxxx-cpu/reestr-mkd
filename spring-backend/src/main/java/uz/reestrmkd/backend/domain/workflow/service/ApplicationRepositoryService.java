package uz.reestrmkd.backend.domain.workflow.service;

import jakarta.transaction.Transactional;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationHistoryEntity;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationLockEntity;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationStepEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationHistoryJpaRepository;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationLockJpaRepository;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationStepJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ApplicationRepositoryService {

    private final ApplicationJpaRepository applicationRepo;
    private final ApplicationHistoryJpaRepository historyRepo;
    private final ApplicationStepJpaRepository stepRepo;
    private final ApplicationLockJpaRepository lockRepo;

    public ApplicationRepositoryService(
        ApplicationJpaRepository applicationRepo,
        ApplicationHistoryJpaRepository historyRepo,
        ApplicationStepJpaRepository stepRepo,
        ApplicationLockJpaRepository lockRepo
    ) {
        this.applicationRepo = applicationRepo;
        this.historyRepo = historyRepo;
        this.stepRepo = stepRepo;
        this.lockRepo = lockRepo;
    }

    public Optional<ApplicationEntity> getApplication(@NonNull UUID applicationId) {
        return applicationRepo.findById(applicationId);
    }

    @Transactional
    public Optional<ApplicationEntity> updateApplicationState(@NonNull UUID applicationId, String nextStatus, String nextSubstatus, Integer nextStep, Integer nextStage) {
        int updated = applicationRepo.updateWorkflowState(applicationId, nextStatus, nextSubstatus, nextStep, nextStage, Instant.now());
        if (updated == 0) {
            return Optional.empty();
        }
        return applicationRepo.findById(applicationId);
    }

    @Transactional
    public UUID addHistory(UUID applicationId, String action, String prevStatus, String nextStatus, String userName, String comment) {
        return addHistory(applicationId, action, prevStatus, nextStatus, userName, comment, Instant.now());
    }

    @Transactional
    public UUID addHistory(UUID applicationId, String action, String prevStatus, String nextStatus, String userName, String comment, Instant createdAt) {
        ApplicationHistoryEntity e = new ApplicationHistoryEntity();
        e.setId(UUID.randomUUID());
        e.setApplicationId(applicationId);
        e.setAction(action);
        e.setPrevStatus(prevStatus);
        e.setNextStatus(nextStatus);
        e.setUserName(userName);
        e.setComment(comment);
        e.setCreatedAt(createdAt == null ? Instant.now() : createdAt);
        historyRepo.save(e);
        return e.getId();
    }

    @Transactional
    public void updateStepCompletion(UUID applicationId, Integer stepIndex, boolean isCompleted) {
        ApplicationStepEntity step = stepRepo.findByApplicationIdAndStepIndex(applicationId, stepIndex).orElseGet(() -> {
            ApplicationStepEntity n = new ApplicationStepEntity();
            n.setId(UUID.randomUUID());
            n.setApplicationId(applicationId);
            n.setStepIndex(stepIndex);
            n.setBlockStatuses(Map.of());
            n.setCreatedAt(Instant.now());
            return n;
        });

        step.setIsCompleted(isCompleted);
        step.setUpdatedAt(Instant.now());
        if (step.getIsVerified() == null) {
            step.setIsVerified(false);
        }
        stepRepo.save(step);
    }

    @Transactional
    public UUID saveStepBlockStatuses(UUID projectId, String scope, Integer stepIndex, Map<String, Object> blockStatuses) {
        ApplicationEntity application = applicationRepo.findByProjectIdAndScopeId(projectId, scope)
            .orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));

        ApplicationStepEntity step = stepRepo.findByApplicationIdAndStepIndex(application.getId(), stepIndex).orElseGet(() -> {
            ApplicationStepEntity created = new ApplicationStepEntity();
            created.setId(UUID.randomUUID());
            created.setApplicationId(application.getId());
            created.setStepIndex(stepIndex);
            created.setCreatedAt(Instant.now());
            return created;
        });

        if (step.getIsCompleted() == null) {
            step.setIsCompleted(false);
        }
        if (step.getIsVerified() == null) {
            step.setIsVerified(false);
        }
        step.setBlockStatuses(blockStatuses == null ? Map.of() : blockStatuses);
        step.setUpdatedAt(Instant.now());
        return stepRepo.save(step).getApplicationId();
    }

    @Transactional
    public void updateStageVerification(UUID applicationId, int stage, boolean isVerified) {
        StageRange range = getStageStepRange(stage);
        for (int i = range.start(); i <= range.end(); i++) {
            final int stepIndex = i;
            ApplicationStepEntity step = stepRepo.findByApplicationIdAndStepIndex(applicationId, stepIndex).orElseGet(() -> {
                ApplicationStepEntity n = new ApplicationStepEntity();
                n.setId(UUID.randomUUID());
                n.setApplicationId(applicationId);
                n.setStepIndex(stepIndex);
                n.setBlockStatuses(Map.of());
                n.setIsCompleted(false);
                n.setCreatedAt(Instant.now());
                return n;
            });
            step.setIsVerified(isVerified);
            step.setUpdatedAt(Instant.now());
            stepRepo.save(step);
        }
    }

    public boolean ensureActorLock(UUID applicationId, String actorUserId) {
        Optional<ApplicationLockEntity> lockOpt = lockRepo.findByApplicationId(applicationId);
        if (lockOpt.isEmpty()) return false;

        ApplicationLockEntity lock = lockOpt.get();
        boolean notExpired = lock.getExpiresAt() != null && lock.getExpiresAt().isAfter(Instant.now());
        return actorUserId != null && actorUserId.equals(lock.getOwnerUserId()) && notExpired;
    }

    public void assertActiveActorLock(UUID applicationId, String actorUserId) {
        Optional<ApplicationLockEntity> lockOpt = lockRepo.findByApplicationId(applicationId);
        if (lockOpt.isEmpty()) {
            throw new ApiException("Application lock is required", "LOCK_REQUIRED", null, 423);
        }

        ApplicationLockEntity lock = lockOpt.get();
        if (lock.getExpiresAt() == null || !lock.getExpiresAt().isAfter(Instant.now())) {
            throw new ApiException("Application lock has expired", "LOCK_EXPIRED", null, 423);
        }

        if (actorUserId == null || !actorUserId.equals(lock.getOwnerUserId())) {
            throw new ApiException("Application lock is held by another user", "LOCK_CONFLICT", null, 409);
        }
    }

    private StageRange getStageStepRange(int stage) {
        int end = switch (stage) {
            case 1 -> 6;
            case 2 -> 9;
            case 3 -> 12;
            case 4 -> 14;
            default -> -1;
        };
        if (end < 0) throw new IllegalArgumentException("Cannot resolve step range for stage " + stage);

        int prevEnd = switch (stage - 1) {
            case 1 -> 6;
            case 2 -> 9;
            case 3 -> 12;
            default -> -1;
        };
        return new StageRange(prevEnd + 1, end);
    }

    private record StageRange(int start, int end) {}
}
