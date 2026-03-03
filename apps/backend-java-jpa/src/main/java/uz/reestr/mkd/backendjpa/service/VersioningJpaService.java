package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.entity.ObjectVersion;
import uz.reestr.mkd.backendjpa.repository.ObjectVersionRepository;

@Service
public class VersioningJpaService {

  private final ObjectVersionRepository objectVersionRepository;
  private final ObjectMapper objectMapper;

  @PersistenceContext
  private EntityManager entityManager;

  public VersioningJpaService(ObjectVersionRepository objectVersionRepository, ObjectMapper objectMapper) {
    this.objectVersionRepository = objectVersionRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public ObjectVersion createVersion(CreateVersionRequest request, String actorUserId) {
    if (request.entityType() == null || request.entityType().isBlank() || request.entityId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "entityType and entityId are required");
    }

    List<ObjectVersion> existing = objectVersionRepository
        .findByEntityTypeAndEntityIdOrderByVersionNumberDesc(request.entityType(), request.entityId());

    for (ObjectVersion version : existing) {
      if ("PENDING".equals(version.getVersionStatus())) {
        version.setVersionStatus("PREVIOUS");
        objectVersionRepository.save(version);
      }
    }

    int nextVersion = existing.isEmpty() ? 1 : (existing.get(0).getVersionNumber() + 1);

    ObjectVersion created = ObjectVersion.builder()
        .entityType(request.entityType())
        .entityId(request.entityId())
        .versionNumber(nextVersion)
        .versionStatus("PENDING")
        .snapshotData(toMap(request.snapshotData()))
        .createdBy(request.createdBy() != null ? request.createdBy() : actorUserId)
        .applicationId(request.applicationId())
        .build();

    return objectVersionRepository.save(created);
  }

  @Transactional
  public PendingVersionsResult createPendingVersionsForProject(UUID projectId, UUID applicationId, String createdBy) {
    List<EntitySnapshotRef> entities = collectProjectEntities(projectId);
    int createdCount = 0;

    for (EntitySnapshotRef entity : entities) {
      List<ObjectVersion> existing = objectVersionRepository
          .findByEntityTypeAndEntityIdOrderByVersionNumberDesc(entity.entityType(), entity.entityId());

      boolean hasPending = existing.stream().anyMatch(v -> "PENDING".equals(v.getVersionStatus()));
      if (hasPending) {
        continue;
      }

      int nextVersion = existing.isEmpty() ? 1 : (existing.get(0).getVersionNumber() + 1);
      ObjectVersion latestCurrent = existing.stream()
          .filter(v -> "CURRENT".equals(v.getVersionStatus()))
          .findFirst()
          .orElse(null);

      ObjectVersion toInsert = ObjectVersion.builder()
          .entityType(entity.entityType())
          .entityId(entity.entityId())
          .versionNumber(nextVersion)
          .versionStatus("PENDING")
          .snapshotData(latestCurrent != null ? latestCurrent.getSnapshotData() : entity.snapshotData())
          .createdBy(createdBy)
          .applicationId(applicationId)
          .build();

      objectVersionRepository.save(toInsert);
      createdCount++;
    }

    return new PendingVersionsResult(createdCount, false);
  }

  private List<EntitySnapshotRef> collectProjectEntities(UUID projectId) {
    List<EntitySnapshotRef> entities = new ArrayList<>();

    List<Object[]> projectRows = entityManager.createNativeQuery("select id, to_jsonb(p.*) from projects p where id = :projectId")
        .setParameter("projectId", projectId)
        .getResultList();
    for (Object[] row : projectRows) {
      entities.add(new EntitySnapshotRef("project", (UUID) row[0], toMap((JsonNode) row[1])));
    }

    List<Object[]> buildingRows = entityManager.createNativeQuery("select id, to_jsonb(b.*) from buildings b where project_id = :projectId")
        .setParameter("projectId", projectId)
        .getResultList();
    for (Object[] row : buildingRows) {
      entities.add(new EntitySnapshotRef("building", (UUID) row[0], toMap((JsonNode) row[1])));
    }

    return entities;
  }

  @SuppressWarnings("unchecked")
  private java.util.Map<String, Object> toMap(JsonNode node) {
    if (node == null || node.isNull()) {
      return java.util.Map.of();
    }
    return objectMapper.convertValue(node, java.util.Map.class);
  }

  public record CreateVersionRequest(
      String entityType,
      UUID entityId,
      JsonNode snapshotData,
      String createdBy,
      UUID applicationId
  ) {
  }

  private record EntitySnapshotRef(String entityType, UUID entityId, java.util.Map<String, Object> snapshotData) {
  }

  public record PendingVersionsResult(int createdCount, boolean skipped) {
  }
}
