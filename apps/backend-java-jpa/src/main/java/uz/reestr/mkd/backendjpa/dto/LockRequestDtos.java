package uz.reestr.mkd.backendjpa.dto;

import java.time.OffsetDateTime;

public final class LockRequestDtos {

  private LockRequestDtos() {
  }

  public record AcquireLockRequest(Integer ttlSeconds) {
  }

  public record RefreshLockRequest(Integer ttlSeconds) {
  }

  public record ReleaseLockRequest() {
  }

  public record LockStateResponse(
      boolean locked,
      String ownerUserId,
      String ownerRole,
      OffsetDateTime expiresAt
  ) {
  }

  public record LockActionResponse(
      boolean ok,
      String reason,
      String message,
      OffsetDateTime expiresAt
  ) {
  }
}
