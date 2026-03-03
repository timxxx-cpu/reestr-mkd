package uz.reestr.mkd.backendjpa.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

public final class VersioningRequestDtos {

  private VersioningRequestDtos() {
  }

  public record CreateVersionRequest(
      String entityType,
      UUID entityId,
      JsonNode snapshotData,
      String createdBy,
      UUID applicationId
  ) {
  }
}
