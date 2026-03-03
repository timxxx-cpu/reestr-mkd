package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.api.error.ApiErrorException;
import uz.reestrmkd.backendjpa.service.ProjectJpaService;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class ProjectController {
    private final ProjectJpaService projects;

    @GetMapping("/projects")
    public Map<String, Object> projects(
        @RequestParam(required = false) String scope,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String workflowSubstatus,
        @RequestParam(required = false) String assignee,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer limit,
        org.springframework.security.core.Authentication authentication
    ) {
        String actorUserId = authentication == null ? null : authentication.getName();
        String actorRole = (authentication == null || authentication.getAuthorities() == null || authentication.getAuthorities().isEmpty())
            ? null
            : authentication.getAuthorities().iterator().next().getAuthority();
        if (actorRole != null && actorRole.startsWith("ROLE_")) actorRole = actorRole.substring(5).toLowerCase();
        return projects.list(scope, status, workflowSubstatus, assignee, search, page, limit, actorUserId, actorRole);
    }
    @GetMapping("/projects/map-overview") public Map<String, Object> projectsMapOverview(@RequestParam(required = false) String scope) { return projects.mapOverview(scope); }
     @GetMapping("/external-applications")
    public Object ext(@RequestParam(required = false) String scope, org.springframework.security.core.Authentication authentication){
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ApiErrorException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Auth context required");
        }
        return projects.externalApplications(scope);
    }
    @GetMapping("/projects/summary-counts") public Map<String,Object> summary(@RequestParam(required = false) String scope){ return projects.summary(scope); }
    @GetMapping("/projects/{projectId}/application-id") public Map<String, Object> appId(@PathVariable String projectId, @RequestParam String scope) { return projects.appId(projectId, scope); }
    @PostMapping("/projects/{projectId}/validation/step") public Map<String,Object> validate(@PathVariable String projectId,@RequestBody Map<String,Object> body){ return projects.validateStep(projectId, body); }

    @PostMapping("/projects/from-application") public Map<String,Object> fromApp(@RequestBody Map<String,Object> body){ return projects.fromApplication(body); }

    @GetMapping("/projects/{projectId}/context") public Map<String,Object> context(@PathVariable String projectId, @RequestParam String scope){ return projects.context(projectId, scope); }
    @PostMapping("/projects/{projectId}/context-building-details/save") public Map<String,Object> contextBuilding(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return projects.contextBuildingSave(projectId, body); }
    @PostMapping("/projects/{projectId}/context-meta/save") public Map<String,Object> contextMeta(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return projects.contextMetaSave(projectId, body); }
    @PostMapping("/projects/{projectId}/step-block-statuses/save") public Map<String,Object> contextStep(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return projects.stepBlockStatusesSave(projectId, body); }
    @GetMapping("/projects/{projectId}/context-registry-details") public Map<String,Object> contextRegistry(@PathVariable String projectId){ return projects.contextRegistryDetails(projectId); }
    @GetMapping("/projects/{projectId}/geometry-candidates") public Object geometryCandidates(@PathVariable String projectId){ return projects.geometryCandidates(projectId); }
    @PostMapping("/projects/{projectId}/geometry-candidates/import")
    public Map<String,Object> importGeometryCandidates(@PathVariable String projectId, @RequestBody Map<String,Object> body){
        Object payload = body == null ? null : body.get("candidates");
        List<Map<String, Object>> candidates = payload instanceof List<?> list ?
            list.stream().filter(Map.class::isInstance).map(m -> (Map<String, Object>) m).toList() : List.of();
        return projects.importGeometryCandidates(projectId, candidates);
    }
    @PostMapping("/projects/{projectId}/land-plot/select")
    public Map<String,Object> selectLandPlot(@PathVariable String projectId, @RequestBody Map<String,Object> body){
        String candidateId = body == null || body.get("candidateId") == null ? null : String.valueOf(body.get("candidateId"));
        return projects.selectLandPlot(projectId, candidateId);
    }
    @PostMapping("/projects/{projectId}/land-plot/unselect") public Map<String,Object> unselectLandPlot(@PathVariable String projectId){ return projects.unselectLandPlot(projectId); }
    @DeleteMapping("/projects/{projectId}/geometry-candidates/{candidateId}") public Map<String,Object> delGeometryCandidate(@PathVariable String projectId, @PathVariable String candidateId){ return projects.deleteGeometryCandidate(projectId, candidateId); }
    @PostMapping("/projects/{projectId}/buildings/{buildingId}/geometry/select")
    public Map<String,Object> selectBuildingGeometry(@PathVariable String projectId, @PathVariable String buildingId, @RequestBody Map<String,Object> body){
        String candidateId = body == null || body.get("candidateId") == null ? null : String.valueOf(body.get("candidateId"));
        return projects.selectBuildingGeometry(projectId, buildingId, candidateId);
    }
    @GetMapping("/projects/{projectId}/passport") public Map<String,Object> passport(@PathVariable String projectId){ return projects.passport(projectId); }
    @PutMapping("/projects/{projectId}/passport") public Map<String,Object> updatePassport(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return projects.updatePassport(projectId, body); }
    @PutMapping("/projects/{projectId}/participants/{role}") public Map<String,Object> participants(@PathVariable String projectId,@PathVariable String role,@RequestBody Map<String,Object> body){ return projects.participants(projectId, role, body); }
    @PostMapping("/projects/{projectId}/documents") public Map<String,Object> docs(@PathVariable String projectId,@RequestBody Map<String,Object> body){ return projects.documents(projectId, body); }
    @DeleteMapping("/project-documents/{documentId}") public Map<String,Object> delDoc(@PathVariable String documentId){ return projects.deleteDoc(documentId); }
    @DeleteMapping("/projects/{projectId}") public Map<String,Object> delProject(@PathVariable String projectId,@RequestParam(required=false) String scope){ return projects.deleteProject(projectId, scope); }

    @GetMapping("/projects/{projectId}/integration-status") public Map<String,Object> integrationGet(@PathVariable String projectId){ return projects.integrationGet(projectId); }
    @PutMapping("/projects/{projectId}/integration-status")
    public Map<String, Object> integration(@PathVariable String projectId, @RequestBody Map<String, Object> body) {
        return projects.integrationStatus(projectId, body);
    }
    @GetMapping("/projects/{projectId}/parking-counts") public Map<String,Object> parking(@PathVariable String projectId){ return projects.parkingCounts(projectId); }
    @GetMapping("/registry/buildings-summary") public Object buildingsSummary(){ return projects.buildingsSummary(); }

    @GetMapping("/projects/{projectId}/basements") public Object basements(@PathVariable String projectId){ return projects.basements(projectId); }
    @PutMapping("/basements/{basementId}/parking-levels/{level}") public Map<String,Object> basement(@PathVariable String basementId,@PathVariable Integer level,@RequestBody Map<String,Object> body){ return projects.updateBasementLevel(basementId, level, body); }

    @GetMapping("/projects/{projectId}/full-registry") public Map<String,Object> fullRegistry(@PathVariable String projectId){ return projects.fullRegistry(projectId); }
    @GetMapping("/projects/{projectId}/tep-summary") public Map<String,Object> tep(@PathVariable String projectId){ return projects.tepSummary(projectId); }
}
