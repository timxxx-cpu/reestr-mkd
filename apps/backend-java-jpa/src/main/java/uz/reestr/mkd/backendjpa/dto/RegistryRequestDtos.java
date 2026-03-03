package uz.reestr.mkd.backendjpa.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class RegistryRequestDtos {

  private RegistryRequestDtos() {
  }

  public record CreateBlockExtensionRequest(BlockExtensionData extensionData) {
  }

  public record UpdateBlockExtensionRequest(BlockExtensionData extensionData) {
  }

  public record BlockExtensionData(
      UUID id,
      UUID buildingId,
      UUID parentBlockId,
      String label,
      String extensionType,
      String constructionKind,
      Integer floorsCount,
      Integer startFloorIndex,
      String verticalAnchorType,
      String anchorFloorKey,
      String notes
  ) {
  }

  public record UpsertUnitRequest(
      UUID id,
      String num,
      BigDecimal area,
      String type,
      Integer rooms,
      UUID buildingId,
      UUID blockId,
      UUID floorId,
      UUID entranceId
  ) {
  }

  public record UpsertCommonAreaRequest(
      UUID id,
      String type,
      BigDecimal area,
      BigDecimal height,
      UUID buildingId,
      UUID blockId,
      UUID floorId,
      UUID entranceId
  ) {
  }

  public record UpdateFloorRequest(FloorUpdates updates) {
  }

  public record FloorUpdates(
      UUID id,
      String floorKey,
      BigDecimal height,
      BigDecimal areaProj,
      BigDecimal areaFact,
      Boolean isDuplex,
      UUID buildingId,
      UUID blockId,
      Integer levelIndex,
      Integer parentFloorIndex,
      UUID basementId,
      FloorFlags flags
  ) {
  }

  public record FloorFlags(
      Boolean isTechnical,
      Boolean isCommercial,
      Boolean isStylobate,
      Boolean isBasement,
      Boolean isAttic,
      Boolean isLoft,
      Boolean isRoof
  ) {
  }

  public record UpsertMatrixCellRequest(
      UUID floorId,
      Integer entranceNumber,
      MatrixCellValues values
  ) {
  }

  public record MatrixCellValues(
      Integer apts,
      Integer units,
      Integer mopQty
  ) {
  }

  public record BatchUpsertMatrixCellsRequest(List<MatrixCellInput> cells) {
  }

  public record MatrixCellInput(
      UUID floorId,
      Integer entranceNumber,
      MatrixCellValues values
  ) {
  }
}
