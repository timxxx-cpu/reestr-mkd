package uz.reestr.mkd.backendjpa.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;

public final class RegistryResponseDtos {

  private RegistryResponseDtos() {
  }

  public record BlockExtensionsResponse(List<JsonNode> extensions) {
  }

  public record BlockExtensionMutationResponse(JsonNode extension) {
  }

  public record FloorsResponse(List<JsonNode> floors) {
  }

  public record EntrancesResponse(List<JsonNode> entrances) {
  }

  public record EntranceMatrixResponse(List<JsonNode> matrix) {
  }

  public record UnitExplicationResponse(JsonNode unit) {
  }

  public record UnitsResponse(List<JsonNode> units) {
  }

  public record CommonAreasResponse(List<JsonNode> commonAreas) {
  }


  public record RoomsResponse(List<JsonNode> rooms) {
  }

  public record UpsertRoomResponse(JsonNode room) {
  }

  public record BlockStructureResponse(JsonNode block) {
  }

  public record UpsertUnitResponse(JsonNode unit) {
  }

  public record UpsertCommonAreaResponse(JsonNode commonArea) {
  }

  public record ReconcileCommonAreasResponse(Integer removed, Integer created, Integer checkedCells) {
  }

  public record ClearCommonAreasResponse(Boolean ok, Integer deleted) {
  }

  public record UpdateFloorResponse(JsonNode floor) {
  }

  public record UpsertMatrixCellResponse(
      UUID id,
      UUID floorId,
      Integer entranceNumber,
      Integer flatsCount,
      Integer commercialCount,
      Integer mopCount
  ) {
  }

  public record BatchUpsertMatrixCellsResponse(Integer updated, List<String> failed) {
  }
}
