package uz.reestr.mkd.backendjpa.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;

public final class ProjectResponseDtos {

  private ProjectResponseDtos() {
  }

  public record ProjectsListResponse(List<JsonNode> projects, JsonNode pagination) {
  }

  public record ProjectsMapOverviewResponse(List<JsonNode> projects) {
  }

  public record ProjectsSummaryCountsResponse(JsonNode counts) {
  }

  public record BuildingsResponse(List<JsonNode> buildings) {
  }

  public record CreateBuildingResponse(JsonNode building, List<JsonNode> blocks) {
  }

  public record ProjectFullRegistryResponse(JsonNode registry) {
  }

  public record ProjectTepSummaryResponse(JsonNode summary) {
  }

  public record ProjectContextResponse(JsonNode context) {
  }

  public record ProjectContextRegistryDetailsResponse(JsonNode details) {
  }

  public record ValidateProjectStepResponse(Boolean valid, List<String> errors) {
  }

  public record SaveProjectContextMetaResponse(Boolean saved) {
  }

  public record SaveStepBlockStatusesResponse(Boolean saved) {
  }

  public record SaveProjectBuildingDetailsResponse(Boolean saved) {
  }

  public record ProjectGeometryCandidatesResponse(List<JsonNode> candidates) {
  }

  public record ImportProjectGeometryCandidatesResponse(Integer importedCount, List<JsonNode> candidates) {
  }

  public record ProjectGeometryCandidateActionResponse(Boolean ok, JsonNode candidate) {
  }

  public record SelectBuildingGeometryResponse(Boolean selected, String candidateId) {
  }

  public record SelectProjectLandPlotResponse(Boolean selected, String candidateId) {
  }

  public record UnselectProjectLandPlotResponse(Boolean selected) {
  }

  public record ProjectPassportResponse(JsonNode info, JsonNode cadastreData) {
  }

  public record UpdateProjectPassportResponse(Boolean updated) {
  }

  public record UpsertProjectParticipantResponse(Boolean updated, JsonNode participant) {
  }

  public record UpsertProjectDocumentResponse(Boolean updated, JsonNode document) {
  }

  public record BasementsResponse(List<JsonNode> basements) {
  }

  public record ParkingCountsResponse(JsonNode counts) {
  }

  public record IntegrationStatusResponse(JsonNode status) {
  }

  public record UpdateIntegrationStatusResponse(Boolean updated, JsonNode status) {
  }

  public record ResolveApplicationIdResponse(UUID applicationId) {
  }

  public record CreateProjectFromApplicationResponse(UUID projectId, UUID applicationId, String ujCode) {
  }
}
