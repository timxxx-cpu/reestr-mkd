package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.JpaFacadeService;
import uz.reestrmkd.backendjpa.service.ProjectJpaService;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class ProjectController {
    private final ProjectJpaService projects;
    private final JpaFacadeService facade;

    @GetMapping("/projects") public Map<String, Object> projects(@RequestParam(required = false) String scope) { return projects.list(scope); }
    @GetMapping("/external-applications") public Object ext(@RequestParam(required = false) String scope){ return List.of(Map.of("id","EXT-10001","scope",scope)); }
    @GetMapping("/projects/summary-counts") public Map<String,Object> summary(@RequestParam(required = false) String scope){ return facade.summary(scope); }
    @GetMapping("/projects/{projectId}/application-id") public Map<String, Object> appId(@PathVariable String projectId, @RequestParam String scope) { return projects.appId(projectId, scope); }
    @PostMapping("/projects/{projectId}/validation/step") public Map<String,Object> validate(@PathVariable String projectId,@RequestBody Map<String,Object> body){ return Map.of("ok", true, "errors", List.of()); }

    @PostMapping("/projects/from-application") public Map<String,Object> fromApp(@RequestBody Map<String,Object> body){ return facade.ok(); }

    @GetMapping("/projects/{projectId}/context") public Map<String,Object> context(@PathVariable String projectId, @RequestParam String scope){ return Map.of("projectId", projectId, "scope", scope); }
    @PostMapping("/projects/{projectId}/context-building-details/save") public Map<String,Object> contextBuilding(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/projects/{projectId}/context-meta/save") public Map<String,Object> contextMeta(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/projects/{projectId}/step-block-statuses/save") public Map<String,Object> contextStep(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @GetMapping("/projects/{projectId}/context-registry-details") public Map<String,Object> contextRegistry(@PathVariable String projectId){ return facade.ok(); }
    @GetMapping("/projects/{projectId}/passport") public Map<String,Object> passport(@PathVariable String projectId){ return facade.ok(); }
    @PutMapping("/projects/{projectId}/passport") public Map<String,Object> updatePassport(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @PutMapping("/projects/{projectId}/participants/{role}") public Map<String,Object> participants(@PathVariable String projectId,@PathVariable String role,@RequestBody Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/projects/{projectId}/documents") public Map<String,Object> docs(@PathVariable String projectId,@RequestBody Map<String,Object> body){ return facade.ok(); }
    @DeleteMapping("/project-documents/{documentId}") public Map<String,Object> delDoc(@PathVariable String documentId){ return facade.ok(); }
    @DeleteMapping("/projects/{projectId}") public Map<String,Object> delProject(@PathVariable String projectId,@RequestParam(required=false) String scope){ return facade.ok(); }

    @GetMapping("/projects/{projectId}/integration-status") public Map<String,Object> integrationGet(@PathVariable String projectId){ return facade.ok(); }
    @PutMapping("/projects/{projectId}/integration-status") public Map<String, Object> integration(@PathVariable String projectId, @RequestBody Map<String, Object> body) { return projects.integrationStatus(projectId, String.valueOf(body.get("integrationStatus"))); }
    @GetMapping("/projects/{projectId}/parking-counts") public Map<String,Object> parking(@PathVariable String projectId){ return facade.ok(); }
    @GetMapping("/registry/buildings-summary") public Object buildingsSummary(){ return facade.nativeList("buildings", null, null); }

    @GetMapping("/projects/{projectId}/basements") public Object basements(@PathVariable String projectId){ return facade.nativeList("basements", "project_id", projectId); }
    @PutMapping("/basements/{basementId}/parking-levels/{level}") public Map<String,Object> basement(@PathVariable String basementId,@PathVariable Integer level,@RequestBody Map<String,Object> body){ return facade.ok(); }

    @GetMapping("/projects/{projectId}/full-registry") public Map<String,Object> fullRegistry(@PathVariable String projectId){ return facade.ok(); }
    @GetMapping("/projects/{projectId}/tep-summary") public Map<String,Object> tep(@PathVariable String projectId){ return facade.ok(); }
}
