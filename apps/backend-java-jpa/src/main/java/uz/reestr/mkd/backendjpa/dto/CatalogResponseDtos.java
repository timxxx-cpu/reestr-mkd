package uz.reestr.mkd.backendjpa.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public final class CatalogResponseDtos {

  private CatalogResponseDtos() {
  }

  public record CatalogItemsResponse(List<JsonNode> items) {
  }

  public record SystemUsersResponse(List<JsonNode> users) {
  }

  public record UpsertCatalogItemResponse(JsonNode item) {
  }

  public record SetCatalogItemActiveResponse(String id, Boolean isActive) {
  }
}
