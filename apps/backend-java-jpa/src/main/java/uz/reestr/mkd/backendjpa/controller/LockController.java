package uz.reestr.mkd.backendjpa.controller;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.AcquireLockRequest;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.LockActionResponse;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.LockStateResponse;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.RefreshLockRequest;
import uz.reestr.mkd.backendjpa.dto.LockRequestDtos.ReleaseLockRequest;
import uz.reestr.mkd.backendjpa.service.LockJpaService;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}/locks")
public class LockController {

  private final LockJpaService lockJpaService;

  public LockController(LockJpaService lockJpaService) {
    this.lockJpaService = lockJpaService;
  }

  @GetMapping
  public ResponseEntity<LockStateResponse> getLock(@PathVariable UUID applicationId) {
    return ResponseEntity.ok(lockJpaService.getLock(applicationId));
  }

  @PostMapping("/acquire")
  public ResponseEntity<LockActionResponse> acquire(
      @PathVariable UUID applicationId,
      @RequestBody(required = false) AcquireLockRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(lockJpaService.acquire(applicationId, request, actorUserId, actorRole));
  }

  @PostMapping("/refresh")
  public ResponseEntity<LockActionResponse> refresh(
      @PathVariable UUID applicationId,
      @RequestBody(required = false) RefreshLockRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    return ResponseEntity.ok(lockJpaService.refresh(applicationId, request, actorUserId));
  }

  @PostMapping("/release")
  public ResponseEntity<LockActionResponse> release(
      @PathVariable UUID applicationId,
      @RequestBody(required = false) ReleaseLockRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    return ResponseEntity.ok(lockJpaService.release(applicationId, actorUserId));
  }
}
