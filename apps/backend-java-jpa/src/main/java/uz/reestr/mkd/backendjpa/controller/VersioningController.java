package uz.reestr.mkd.backendjpa.controller;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.VersioningRequestDtos.CreateVersionRequest;
import uz.reestr.mkd.backendjpa.entity.ObjectVersion;
import uz.reestr.mkd.backendjpa.service.VersioningJpaService;

@RestController
@RequestMapping("/api/v1/versions")
public class VersioningController {

  private final VersioningJpaService versioningJpaService;

  public VersioningController(VersioningJpaService versioningJpaService) {
    this.versioningJpaService = versioningJpaService;
  }

  @GetMapping
  public ResponseEntity<Void> getVersions(
      @RequestParam(required = false) String entityType,
      @RequestParam(required = false) UUID entityId
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping
  public ResponseEntity<ObjectVersion> createVersion(
      @RequestBody CreateVersionRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    return ResponseEntity.ok(versioningJpaService.createVersion(
        new VersioningJpaService.CreateVersionRequest(
            request.entityType(),
            request.entityId(),
            request.snapshotData(),
            request.createdBy(),
            request.applicationId()),
        actorUserId));
  }

  @PostMapping("/{versionId}/approve")
  public ResponseEntity<Void> approveVersion(@PathVariable UUID versionId) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{versionId}/decline")
  public ResponseEntity<Void> declineVersion(@PathVariable UUID versionId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/{versionId}/snapshot")
  public ResponseEntity<Void> getVersionSnapshot(@PathVariable UUID versionId) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{versionId}/restore")
  public ResponseEntity<Void> restoreVersion(@PathVariable UUID versionId) {
    return ResponseEntity.noContent().build();
  }
}
