package uz.reestr.mkd.backendjpa.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;

public final class ProjectRequestDtos {

  private ProjectRequestDtos() {
  }

  public record ValidateProjectStepRequest(String scope, String stepId) {
  }

  public record SaveProjectContextMetaRequest(
      String scope,
      JsonNode complexInfo,
      JsonNode applicationInfo
  ) {
  }

  public record SaveStepBlockStatusesRequest(
      String scope,
      Integer stepIndex,
      JsonNode statuses
  ) {
  }

  public record SaveProjectBuildingDetailsRequest(JsonNode buildingDetails) {
  }

  public record ImportProjectGeometryCandidatesRequest(List<JsonNode> candidates) {
  }

  public record SelectBuildingGeometryRequest(String candidateId) {
  }

  public record SelectProjectLandPlotRequest(String candidateId) {
  }

  public record ApproveProjectGeometryCandidateRequest(UUID buildingId, Boolean selectAsLandPlot) {
  }

  public record DeclineProjectGeometryCandidateRequest(String reason) {
  }

  public record UpdateProjectPassportRequest(JsonNode info, JsonNode cadastreData) {
  }

  public record UpsertProjectParticipantRequest(JsonNode data) {
  }

  public record UpsertProjectDocumentRequest(JsonNode doc) {
  }

  public record CreateProjectFromApplicationRequest(String scope, JsonNode appData) {
  }

  public record UpdateIntegrationStatusRequest(String field, String status) {
  }

  public record CreateBuildingRequest(JsonNode buildingData, JsonNode blocksData) {
  }
}
