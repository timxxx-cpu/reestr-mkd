package uz.reestr.mkd.backendjpa.controller;

import java.util.UUID;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.databind.JsonNode;
import uz.reestr.mkd.backendjpa.dto.PaginatedResponseDto;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.CreateBuildingRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.CreateProjectFromApplicationRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.DeclineProjectGeometryCandidateRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.ImportProjectGeometryCandidatesRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.ApproveProjectGeometryCandidateRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveProjectBuildingDetailsRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveProjectContextMetaRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveStepBlockStatusesRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SelectBuildingGeometryRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SelectProjectLandPlotRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpdateProjectPassportRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpsertProjectDocumentRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpsertProjectParticipantRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.ValidateProjectStepRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.BasementsResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.BuildingsResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.CreateBuildingResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.CreateProjectFromApplicationResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ImportProjectGeometryCandidatesResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectGeometryCandidateActionResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ParkingCountsResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectContextRegistryDetailsResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectContextResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectFullRegistryResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectGeometryCandidatesResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectPassportResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectsMapOverviewResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectsSummaryCountsResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ProjectTepSummaryResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ResolveApplicationIdResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.SaveProjectBuildingDetailsResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.SaveProjectContextMetaResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.SaveStepBlockStatusesResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.SelectBuildingGeometryResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.SelectProjectLandPlotResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.UnselectProjectLandPlotResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.UpdateProjectPassportResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.UpsertProjectDocumentResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.UpsertProjectParticipantResponse;
import uz.reestr.mkd.backendjpa.dto.ProjectResponseDtos.ValidateProjectStepResponse;
import uz.reestr.mkd.backendjpa.service.ProjectJpaService;

@RestController
@RequestMapping("/api/v1")
public class ProjectController {

  private final ProjectJpaService projectJpaService;

  public ProjectController(ProjectJpaService projectJpaService) {
    this.projectJpaService = projectJpaService;
  }

  @GetMapping("/projects")
  public ResponseEntity<PaginatedResponseDto<JsonNode>> getProjectsList(
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String workflowSubstatus,
      @RequestParam(required = false) String assignee,
      @RequestParam(required = false) String search,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(projectJpaService.getProjectsList(scope, page, size, actorUserId, actorRole));
  }

  @GetMapping("/projects/map-overview")
  public ResponseEntity<ProjectsMapOverviewResponse> getProjectsMapOverview(
      @RequestParam(required = false) String scope,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(new ProjectsMapOverviewResponse(projectJpaService.getProjectsMapOverview(scope, actorUserId, actorRole)));
  }

  @GetMapping("/projects/summary-counts")
  public ResponseEntity<ProjectsSummaryCountsResponse> getProjectsSummaryCounts(
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String assignee,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId,
      @RequestHeader(value = "x-user-role", required = false) String actorRole
  ) {
    return ResponseEntity.ok(new ProjectsSummaryCountsResponse(projectJpaService.getProjectsSummaryCounts(scope, assignee, actorUserId, actorRole)));
  }

  @GetMapping("/projects/{projectId}/buildings")
  public ResponseEntity<BuildingsResponse> getBuildings(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new BuildingsResponse(projectJpaService.getProjectBuildingsHierarchy(projectId)));
  }

  @GetMapping("/projects/{projectId}/buildings/hierarchy")
  public ResponseEntity<BuildingsResponse> getBuildingsHierarchy(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new BuildingsResponse(projectJpaService.getProjectBuildingsHierarchy(projectId)));
  }

  @PostMapping("/projects/{projectId}/buildings")
  public ResponseEntity<CreateBuildingResponse> createBuilding(
      @PathVariable UUID projectId,
      @RequestBody CreateBuildingRequest request
  ) {
    JsonNode building = projectJpaService.createBuilding(projectId, request);
    List<JsonNode> blocks = List.of();
    if (building != null && building.has("blocks") && building.get("blocks").isArray()) {
      blocks = new java.util.ArrayList<>();
      building.get("blocks").forEach(blocks::add);
    }
    return ResponseEntity.ok(new CreateBuildingResponse(building, blocks));
  }

  @GetMapping("/projects/{projectId}/full-registry")
  public ResponseEntity<ProjectFullRegistryResponse> getProjectFullRegistry(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new ProjectFullRegistryResponse(projectJpaService.getProjectContext(projectId)));
  }

  @GetMapping("/projects/{projectId}/tep-summary")
  public ResponseEntity<ProjectTepSummaryResponse> getProjectTepSummary(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new ProjectTepSummaryResponse(projectJpaService.tepSummary(projectId)));
  }

  @GetMapping("/projects/{projectId}/context")
  public ResponseEntity<ProjectContextResponse> getProjectContext(
      @PathVariable UUID projectId,
      @RequestParam(required = false) String scope
  ) {
    return ResponseEntity.ok(new ProjectContextResponse(projectJpaService.getProjectContext(projectId)));
  }

  @GetMapping("/projects/{projectId}/context-registry-details")
  public ResponseEntity<ProjectContextRegistryDetailsResponse> getProjectContextRegistryDetails(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new ProjectContextRegistryDetailsResponse(projectJpaService.getProjectRegistryDetails(projectId)));
  }

  @PostMapping("/projects/{projectId}/validation/step")
  public ResponseEntity<ValidateProjectStepResponse> validateProjectStep(
      @PathVariable UUID projectId,
      @RequestBody ValidateProjectStepRequest request
  ) {
    return ResponseEntity.ok(new ValidateProjectStepResponse(projectJpaService.validateProjectStep(projectId, request), List.of()));
  }

  @PostMapping("/projects/{projectId}/context-meta/save")
  public ResponseEntity<SaveProjectContextMetaResponse> saveProjectContextMeta(
      @PathVariable UUID projectId,
      @RequestBody SaveProjectContextMetaRequest request
  ) {
    projectJpaService.saveContextMeta(projectId, request);
    return ResponseEntity.ok(new SaveProjectContextMetaResponse(true));
  }

  @PostMapping("/projects/{projectId}/step-block-statuses/save")
  public ResponseEntity<SaveStepBlockStatusesResponse> saveStepBlockStatuses(
      @PathVariable UUID projectId,
      @RequestBody SaveStepBlockStatusesRequest request
  ) {
    projectJpaService.saveStepBlockStatuses(projectId, request);
    return ResponseEntity.ok(new SaveStepBlockStatusesResponse(true));
  }

  @PostMapping("/projects/{projectId}/context-building-details/save")
  public ResponseEntity<SaveProjectBuildingDetailsResponse> saveProjectBuildingDetails(
      @PathVariable UUID projectId,
      @RequestBody SaveProjectBuildingDetailsRequest request
  ) {
    projectJpaService.saveBuildingDetails(projectId, request);
    return ResponseEntity.ok(new SaveProjectBuildingDetailsResponse(true));
  }

  @GetMapping("/projects/{projectId}/geometry-candidates")
  public ResponseEntity<ProjectGeometryCandidatesResponse> getProjectGeometryCandidates(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new ProjectGeometryCandidatesResponse(projectJpaService.getProjectGeometryCandidates(projectId)));
  }

  @PostMapping("/projects/{projectId}/geometry-candidates/import")
  public ResponseEntity<ImportProjectGeometryCandidatesResponse> importProjectGeometryCandidates(
      @PathVariable UUID projectId,
      @RequestBody ImportProjectGeometryCandidatesRequest request
  ) {
    var imported = projectJpaService.importProjectGeometryCandidates(projectId, request);
    return ResponseEntity.ok(new ImportProjectGeometryCandidatesResponse(imported.size(), imported));
  }

  @PostMapping("/projects/{projectId}/geometry-candidates/{candidateId}/approve")
  public ResponseEntity<ProjectGeometryCandidateActionResponse> approveProjectGeometryCandidate(
      @PathVariable UUID projectId,
      @PathVariable UUID candidateId,
      @RequestBody(required = false) ApproveProjectGeometryCandidateRequest request
  ) {
    var candidate = projectJpaService.approveProjectGeometryCandidate(
        projectId,
        candidateId,
        request == null ? null : request.buildingId(),
        request != null && Boolean.TRUE.equals(request.selectAsLandPlot())
    );
    return ResponseEntity.ok(new ProjectGeometryCandidateActionResponse(true, candidate));
  }

  @PostMapping("/projects/{projectId}/geometry-candidates/{candidateId}/decline")
  public ResponseEntity<ProjectGeometryCandidateActionResponse> declineProjectGeometryCandidate(
      @PathVariable UUID projectId,
      @PathVariable UUID candidateId,
      @RequestBody(required = false) DeclineProjectGeometryCandidateRequest request
  ) {
    var candidate = projectJpaService.declineProjectGeometryCandidate(
        projectId,
        candidateId,
        request == null ? null : request.reason()
    );
    return ResponseEntity.ok(new ProjectGeometryCandidateActionResponse(true, candidate));
  }

  @DeleteMapping("/projects/{projectId}/geometry-candidates/{candidateId}")
  public ResponseEntity<Void> deleteProjectGeometryCandidate(
      @PathVariable UUID projectId,
      @PathVariable UUID candidateId
  ) {
    projectJpaService.deleteProjectGeometryCandidate(projectId, candidateId);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/buildings/{buildingId}/geometry/select")
  public ResponseEntity<SelectBuildingGeometryResponse> selectBuildingGeometry(
      @PathVariable UUID projectId,
      @PathVariable UUID buildingId,
      @RequestBody SelectBuildingGeometryRequest request
  ) {
    UUID candidateId = projectJpaService.selectBuildingGeometry(projectId, buildingId, request);
    return ResponseEntity.ok(new SelectBuildingGeometryResponse(true, candidateId.toString()));
  }

  @PostMapping("/projects/{projectId}/land-plot/select")
  public ResponseEntity<SelectProjectLandPlotResponse> selectProjectLandPlot(
      @PathVariable UUID projectId,
      @RequestBody SelectProjectLandPlotRequest request
  ) {
    UUID candidateId = projectJpaService.selectLandPlot(projectId, request);
    return ResponseEntity.ok(new SelectProjectLandPlotResponse(true, candidateId.toString()));
  }

  @PostMapping("/projects/{projectId}/land-plot/unselect")
  public ResponseEntity<UnselectProjectLandPlotResponse> unselectProjectLandPlot(@PathVariable UUID projectId) {
    projectJpaService.unselectLandPlot(projectId);
    return ResponseEntity.ok(new UnselectProjectLandPlotResponse(false));
  }

  @GetMapping("/projects/{projectId}/passport")
  public ResponseEntity<ProjectPassportResponse> getProjectPassport(@PathVariable UUID projectId) {
    JsonNode passport = projectJpaService.getProjectPassport(projectId);
    return ResponseEntity.ok(new ProjectPassportResponse(passport.path("info"), passport.path("cadastreData")));
  }

  @PutMapping("/projects/{projectId}/passport")
  public ResponseEntity<UpdateProjectPassportResponse> updateProjectPassport(
      @PathVariable UUID projectId,
      @RequestBody UpdateProjectPassportRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    projectJpaService.validateAndUpdatePassport(projectId, request);
    return ResponseEntity.ok(new UpdateProjectPassportResponse(true));
  }

  @PutMapping("/projects/{projectId}/participants/{role}")
  public ResponseEntity<UpsertProjectParticipantResponse> upsertProjectParticipant(
      @PathVariable UUID projectId,
      @PathVariable String role,
      @RequestBody UpsertProjectParticipantRequest request
  ) {
    return ResponseEntity.ok(new UpsertProjectParticipantResponse(true, projectJpaService.upsertParticipant(projectId, role, request)));
  }

  @PostMapping("/projects/{projectId}/documents")
  public ResponseEntity<UpsertProjectDocumentResponse> upsertProjectDocument(
      @PathVariable UUID projectId,
      @RequestBody UpsertProjectDocumentRequest request
  ) {
    return ResponseEntity.ok(new UpsertProjectDocumentResponse(true, projectJpaService.upsertDocument(projectId, request)));
  }

  @DeleteMapping("/project-documents/{documentId}")
  public ResponseEntity<Void> deleteProjectDocument(@PathVariable UUID documentId) {
    projectJpaService.deleteProjectDocument(documentId);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/projects/{projectId}")
  public ResponseEntity<Void> deleteProject(
      @PathVariable UUID projectId,
      @RequestParam(required = false) String scope
  ) {
    projectJpaService.deleteProject(projectId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/basements")
  public ResponseEntity<BasementsResponse> getBasements(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new BasementsResponse(projectJpaService.basements(projectId)));
  }


  @GetMapping("/basements")
  public ResponseEntity<BasementsResponse> getBasementsByBuildingIds(
      @RequestParam(required = false) String buildingIds
  ) {
    List<UUID> ids = buildingIds == null || buildingIds.isBlank()
        ? List.of()
        : java.util.Arrays.stream(buildingIds.split(","))
            .map(String::trim)
            .filter(v -> !v.isBlank())
            .map(UUID::fromString)
            .toList();
    return ResponseEntity.ok(new BasementsResponse(projectJpaService.basementsByBuildingIds(ids)));
  }

  @PutMapping("/basements/{basementId}/parking-levels/{level}")
  public ResponseEntity<JsonNode> toggleBasementLevel(
      @PathVariable UUID basementId,
      @PathVariable Integer level,
      @RequestBody(required = false) JsonNode body
  ) {
    boolean enabled = body != null && body.path("isEnabled").asBoolean(false);
    return ResponseEntity.ok(projectJpaService.toggleBasementLevel(basementId, level, enabled));
  }

  @PostMapping("/floors/{floorId}/parking-places/sync")
  public ResponseEntity<JsonNode> syncParkingPlaces(
      @PathVariable UUID floorId,
      @RequestBody(required = false) JsonNode body
  ) {
    Integer targetCount = body != null && body.has("targetCount") && body.get("targetCount").isNumber()
        ? body.get("targetCount").asInt()
        : 0;
    return ResponseEntity.ok(projectJpaService.syncParkingPlaces(floorId, targetCount));
  }

  @PostMapping("/projects/from-application")
  public ResponseEntity<CreateProjectFromApplicationResponse> createProjectFromApplication(
      @RequestBody CreateProjectFromApplicationRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    return ResponseEntity.ok(projectJpaService.createProjectFromApplication(request, actorUserId));
  }

  @GetMapping("/projects/{projectId}/parking-counts")
  public ResponseEntity<ParkingCountsResponse> getParkingCounts(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new ParkingCountsResponse(projectJpaService.parkingCounts(projectId)));
  }

  @GetMapping("/projects/{projectId}/application-id")
  public ResponseEntity<ResolveApplicationIdResponse> resolveApplicationId(
      @PathVariable UUID projectId,
      @RequestParam(required = false) String scope
  ) {
    return ResponseEntity.ok(new ResolveApplicationIdResponse(projectJpaService.resolveApplicationId(projectId)));
  }
}
