package uz.reestr.mkd.backendjpa.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;

public final class IntegrationResponseDtos {

  private IntegrationResponseDtos() {
  }

  public record IntegrationStatusResponse(JsonNode status) {
  }

  public record UpdateIntegrationStatusResponse(Boolean updated, JsonNode status) {
  }

  public record UpdateCadastreResponse(Boolean ok, UUID id, String cadastre) {
  }

  public record SyncEntityResult(UUID id, String externalId, String integrationStatus, String cadastre) {
  }

  public record SyncResultResponse(Boolean ok, Integer updatedCount, List<SyncEntityResult> updated) {
  }
}
