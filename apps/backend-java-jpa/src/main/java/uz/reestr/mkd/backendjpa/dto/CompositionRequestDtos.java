package uz.reestr.mkd.backendjpa.dto;

import java.util.List;
import java.util.UUID;

public final class CompositionRequestDtos {

  private CompositionRequestDtos() {
  }

  public record BatchUpsertUnitsRequest(List<UnitInput> unitsList) {
  }

  public record UnitInput(
      UUID id,
      String num,
      java.math.BigDecimal area,
      String type,
      Integer rooms,
      UUID buildingId,
      UUID blockId,
      UUID floorId,
      UUID entranceId
  ) {
  }

  public record ReconcileUnitsForBlockRequest(ReconcileUnitsOptions options) {
  }

  public record ReconcileUnitsOptions(
      Boolean force,
      Boolean dryRun,
      List<UUID> floorIds
  ) {
  }

  public record ReconcileCommonAreasForBlockRequest(ReconcileCommonAreasOptions options) {
  }

  public record ReconcileCommonAreasOptions(
      Boolean force,
      Boolean dryRun,
      List<UUID> floorIds
  ) {
  }

  public record PreviewReconcileByBlockRequest(ReconcilePreviewOptions options) {
  }

  public record ReconcilePreviewOptions(
      Boolean includeUnits,
      Boolean includeCommonAreas,
      List<UUID> floorIds
  ) {
  }

  public record ClearCommonAreasRequest(String floorIds) {
  }

  public record UpdateFloorsBatchRequest(List<FloorBatchItem> items) {
  }

  public record FloorBatchItem(
      UUID id,
      RegistryRequestDtos.FloorUpdates updates
  ) {
  }

  public record ReconcileFloorsRequest(
      Integer floorsFrom,
      Integer floorsTo,
      String defaultType,
      ReconcileFloorsOptions options
  ) {
  }

  public record ReconcileFloorsOptions(
      Boolean includeTechnical,
      Boolean includeCommercial,
      List<FloorTemplateRule> rules
  ) {
  }

  public record FloorTemplateRule(
      Integer from,
      Integer to,
      String floorType,
      RegistryRequestDtos.FloorFlags flags
  ) {
  }

  public record ReconcileEntrancesRequest(Integer count) {
  }
}
