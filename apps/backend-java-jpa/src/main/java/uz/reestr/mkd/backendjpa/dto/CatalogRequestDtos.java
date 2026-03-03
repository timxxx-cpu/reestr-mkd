package uz.reestr.mkd.backendjpa.dto;

import com.fasterxml.jackson.databind.JsonNode;

public final class CatalogRequestDtos {

  private CatalogRequestDtos() {
  }

  public record UpsertCatalogItemRequest(JsonNode item) {
  }

  public record SetCatalogItemActiveRequest(Boolean isActive) {
  }
}
