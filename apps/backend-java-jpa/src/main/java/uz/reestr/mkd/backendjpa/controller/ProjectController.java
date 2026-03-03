package uz.reestr.mkd.backendjpa.controller;

import java.util.UUID;
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
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.CreateBuildingRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.CreateProjectFromApplicationRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.ImportProjectGeometryCandidatesRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveProjectBuildingDetailsRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveProjectContextMetaRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SaveStepBlockStatusesRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SelectBuildingGeometryRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.SelectProjectLandPlotRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpdateIntegrationStatusRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpdateProjectPassportRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpsertProjectDocumentRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpsertProjectParticipantRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.ValidateProjectStepRequest;
import uz.reestr.mkd.backendjpa.service.ProjectJpaService;

@RestController
@RequestMapping("/api/v1")
public class ProjectController {

  private final ProjectJpaService projectJpaService;

  public ProjectController(ProjectJpaService projectJpaService) {
    this.projectJpaService = projectJpaService;
  }

  @GetMapping("/projects")
  public ResponseEntity<Void> getProjectsList(
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String workflowSubstatus,
      @RequestParam(required = false) String assignee,
      @RequestParam(required = false) String search,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer limit
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/map-overview")
  public ResponseEntity<Void> getProjectsMapOverview(@RequestParam(required = false) String scope) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/summary-counts")
  public ResponseEntity<Void> getProjectsSummaryCounts(
      @RequestParam(required = false) String scope,
      @RequestParam(required = false) String assignee
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/buildings")
  public ResponseEntity<Void> getBuildings(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/buildings")
  public ResponseEntity<Void> createBuilding(
      @PathVariable UUID projectId,
      @RequestBody CreateBuildingRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/full-registry")
  public ResponseEntity<Void> getProjectFullRegistry(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/tep-summary")
  public ResponseEntity<Void> getProjectTepSummary(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/context")
  public ResponseEntity<Void> getProjectContext(
      @PathVariable UUID projectId,
      @RequestParam(required = false) String scope
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/context-registry-details")
  public ResponseEntity<Void> getProjectContextRegistryDetails(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/validation/step")
  public ResponseEntity<Void> validateProjectStep(
      @PathVariable UUID projectId,
      @RequestBody ValidateProjectStepRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/context-meta/save")
  public ResponseEntity<Void> saveProjectContextMeta(
      @PathVariable UUID projectId,
      @RequestBody SaveProjectContextMetaRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/step-block-statuses/save")
  public ResponseEntity<Void> saveStepBlockStatuses(
      @PathVariable UUID projectId,
      @RequestBody SaveStepBlockStatusesRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/context-building-details/save")
  public ResponseEntity<Void> saveProjectBuildingDetails(
      @PathVariable UUID projectId,
      @RequestBody SaveProjectBuildingDetailsRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/geometry-candidates")
  public ResponseEntity<Void> getProjectGeometryCandidates(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/geometry-candidates/import")
  public ResponseEntity<Void> importProjectGeometryCandidates(
      @PathVariable UUID projectId,
      @RequestBody ImportProjectGeometryCandidatesRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/projects/{projectId}/geometry-candidates/{candidateId}")
  public ResponseEntity<Void> deleteProjectGeometryCandidate(
      @PathVariable UUID projectId,
      @PathVariable UUID candidateId
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/buildings/{buildingId}/geometry/select")
  public ResponseEntity<Void> selectBuildingGeometry(
      @PathVariable UUID projectId,
      @PathVariable UUID buildingId,
      @RequestBody SelectBuildingGeometryRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/land-plot/select")
  public ResponseEntity<Void> selectProjectLandPlot(
      @PathVariable UUID projectId,
      @RequestBody SelectProjectLandPlotRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/land-plot/unselect")
  public ResponseEntity<Void> unselectProjectLandPlot(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/passport")
  public ResponseEntity<Void> getProjectPassport(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/projects/{projectId}/passport")
  public ResponseEntity<Void> updateProjectPassport(
      @PathVariable UUID projectId,
      @RequestBody UpdateProjectPassportRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    projectJpaService.validateAndUpdatePassport(projectId, request);
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/projects/{projectId}/participants/{role}")
  public ResponseEntity<Void> upsertProjectParticipant(
      @PathVariable UUID projectId,
      @PathVariable String role,
      @RequestBody UpsertProjectParticipantRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/{projectId}/documents")
  public ResponseEntity<Void> upsertProjectDocument(
      @PathVariable UUID projectId,
      @RequestBody UpsertProjectDocumentRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/project-documents/{documentId}")
  public ResponseEntity<Void> deleteProjectDocument(@PathVariable UUID documentId) {
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/projects/{projectId}")
  public ResponseEntity<Void> deleteProject(
      @PathVariable UUID projectId,
      @RequestParam(required = false) String scope
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/basements")
  public ResponseEntity<Void> getBasements(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/projects/from-application")
  public ResponseEntity<ProjectJpaService.CreateProjectResult> createProjectFromApplication(
      @RequestBody CreateProjectFromApplicationRequest request,
      @RequestHeader(value = "x-user-id", required = false) String actorUserId
  ) {
    return ResponseEntity.ok(projectJpaService.createProjectFromApplication(request, actorUserId));
  }

  @GetMapping("/projects/{projectId}/parking-counts")
  public ResponseEntity<Void> getParkingCounts(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/integration-status")
  public ResponseEntity<Void> getIntegrationStatus(@PathVariable UUID projectId) {
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/projects/{projectId}/integration-status")
  public ResponseEntity<Void> updateIntegrationStatus(
      @PathVariable UUID projectId,
      @RequestBody UpdateIntegrationStatusRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/projects/{projectId}/application-id")
  public ResponseEntity<Void> resolveApplicationId(
      @PathVariable UUID projectId,
      @RequestParam(required = false) String scope
  ) {
    return ResponseEntity.noContent().build();
  }
}
