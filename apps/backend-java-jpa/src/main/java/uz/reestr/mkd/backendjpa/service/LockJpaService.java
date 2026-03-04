package uz.reestr.mkd.backendjpa.service;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.AcquireLockRequest;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.LockActionResponse;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.LockStateResponse;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.RefreshLockRequest;
import uz.reestr.mkd.backendjpa.entity.ApplicationEntity;
import uz.reestr.mkd.backendjpa.entity.ApplicationLockEntity;
import uz.reestr.mkd.backendjpa.repository.ApplicationLockRepository;
import uz.reestr.mkd.backendjpa.repository.ApplicationRepository;

@Service
public class LockJpaService {

  private final ApplicationLockRepository applicationLockRepository;
  private final ApplicationRepository applicationRepository;
  private final SimpMessagingTemplate messagingTemplate;

  public LockJpaService(
      ApplicationLockRepository applicationLockRepository,
      ApplicationRepository applicationRepository,
      SimpMessagingTemplate messagingTemplate
  ) {
    this.applicationLockRepository = applicationLockRepository;
    this.applicationRepository = applicationRepository;
    this.messagingTemplate = messagingTemplate;
  }

  @Transactional(readOnly = true)
  public LockStateResponse getLock(UUID applicationId) {
    return applicationLockRepository.findByApplication_Id(applicationId)
        .map(lock -> new LockStateResponse(true, lock.getOwnerUserId(), lock.getOwnerRole(), lock.getExpiresAt()))
        .orElseGet(() -> new LockStateResponse(false, null, null, null));
  }

  @Transactional
  public LockActionResponse acquire(UUID applicationId, AcquireLockRequest request, String actorUserId, String actorRole) {
    if (actorUserId == null || actorUserId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "x-user-id is required");
    }

    ApplicationEntity application = findApplication(applicationId);
    if ("technician".equals(actorRole)
        && application.getAssigneeName() != null
        && !application.getAssigneeName().equals(actorUserId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ASSIGNEE_MISMATCH");
    }

    int ttl = Math.max(60, request != null && request.ttlSeconds() != null ? request.ttlSeconds() : 1200);
    OffsetDateTime expiresAt = OffsetDateTime.now().plusSeconds(ttl);

    ApplicationLockEntity existing = applicationLockRepository.findByApplication_Id(applicationId).orElse(null);
    if (existing == null) {
      ApplicationLockEntity created = ApplicationLockEntity.builder()
          .application(application)
          .ownerUserId(actorUserId)
          .ownerRole(actorRole)
          .acquiredAt(OffsetDateTime.now())
          .expiresAt(expiresAt)
          .build();
      applicationLockRepository.save(created);
      publishLockState(applicationId, true, actorUserId, actorRole, expiresAt);
      return new LockActionResponse(true, "OK", "LOCK_ACQUIRED", expiresAt);
    }

    if (actorUserId.equals(existing.getOwnerUserId()) || existing.getExpiresAt().isBefore(OffsetDateTime.now())) {
      existing.setOwnerUserId(actorUserId);
      existing.setOwnerRole(actorRole);
      existing.setAcquiredAt(OffsetDateTime.now());
      existing.setExpiresAt(expiresAt);
      applicationLockRepository.save(existing);
      publishLockState(applicationId, true, actorUserId, actorRole, expiresAt);
      return new LockActionResponse(true, "OK", "LOCK_ACQUIRED", expiresAt);
    }

    throw new ResponseStatusException(HttpStatus.CONFLICT, "LOCKED");
  }

  @Transactional
  public LockActionResponse refresh(UUID applicationId, RefreshLockRequest request, String actorUserId) {
    if (actorUserId == null || actorUserId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "x-user-id is required");
    }

    ApplicationLockEntity existing = applicationLockRepository.findByApplication_Id(applicationId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "LOCK_NOT_FOUND"));

    if (!actorUserId.equals(existing.getOwnerUserId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "LOCK_OWNER_MISMATCH");
    }

    int ttl = Math.max(60, request != null && request.ttlSeconds() != null ? request.ttlSeconds() : 1200);
    OffsetDateTime expiresAt = OffsetDateTime.now().plusSeconds(ttl);
    existing.setExpiresAt(expiresAt);
    applicationLockRepository.save(existing);

    return new LockActionResponse(true, "OK", "LOCK_REFRESHED", expiresAt);
  }

  @Transactional
  public LockActionResponse release(UUID applicationId, String actorUserId) {
    if (actorUserId == null || actorUserId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "x-user-id is required");
    }

    ApplicationLockEntity existing = applicationLockRepository.findByApplication_Id(applicationId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "LOCK_NOT_FOUND"));

    if (!actorUserId.equals(existing.getOwnerUserId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "LOCK_OWNER_MISMATCH");
    }

    applicationLockRepository.deleteByApplication_Id(applicationId);
    publishLockState(applicationId, false, null, null, null);
    return new LockActionResponse(true, "OK", "LOCK_RELEASED", null);
  }

  private void publishLockState(
      UUID applicationId,
      boolean locked,
      String ownerUserId,
      String ownerRole,
      OffsetDateTime expiresAt
  ) {
    messagingTemplate.convertAndSend(
        "/topic/locks/" + applicationId,
        new LockStateResponse(locked, ownerUserId, ownerRole, expiresAt)
    );
  }

  private ApplicationEntity findApplication(UUID applicationId) {
    return applicationRepository.findById(applicationId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "NOT_FOUND"));
  }
}
