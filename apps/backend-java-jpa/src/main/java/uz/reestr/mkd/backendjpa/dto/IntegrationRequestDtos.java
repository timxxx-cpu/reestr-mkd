package uz.reestr.mkd.backendjpa.dto;

import java.util.List;
import java.util.UUID;

public final class IntegrationRequestDtos {

  private IntegrationRequestDtos() {
  }

  public record UpdateIntegrationStatusRequest(String field, String status) {
  }

  public record UpdateCadastreRequest(String cadastre) {
  }

  public record SyncBuildingsRequest(List<BuildingSyncItem> items) {
  }

  public record SyncUnitsRequest(List<UnitSyncItem> items) {
  }

  public record BuildingSyncItem(
      UUID buildingId,
      String externalId,
      String integrationStatus,
      String cadastre
  ) {
  }

  public record UnitSyncItem(
      UUID unitId,
      String externalId,
      String integrationStatus,
      String cadastre
  ) {
  }
}
