package uz.reestrmkd.backend.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.application.ProjectService;
import uz.reestrmkd.backend.security.PolicyService;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class ProjectController {
    private final ProjectService projects;
    private final PolicyService policy;

    public ProjectController(ProjectService projects, PolicyService policy) { this.projects = projects; this.policy = policy; }

    @GetMapping("/projects") public Map<String, Object> projects(@RequestParam Map<String,String> q) { return projects.projects(q.get("scope")); }
    @GetMapping("/external-applications") public Object extApps(@RequestParam Map<String,String> q) { return projects.externalApplications(q.get("scope")); }
    @GetMapping("/projects/summary-counts") public Map<String, Object> summary(@RequestParam Map<String,String> q) { return projects.summaryCounts(q.get("scope")); }
    @GetMapping("/projects/{projectId}/application-id") public Map<String, Object> appId(@PathVariable String projectId, @RequestParam(required = false) String scope) { return projects.applicationId(projectId, scope); }
    @PostMapping("/projects/{projectId}/validation/step") public Map<String, Object> validateStep(@PathVariable String projectId, @RequestBody Map<String,Object> body) { policy.require("validation", "mutate", "Role cannot validate project step"); return projects.validateStep(projectId, String.valueOf(body.get("scope")), String.valueOf(body.get("stepId"))); }

    @PostMapping("/projects/from-application") public Map<String, Object> fromApplication(@RequestBody Map<String,Object> body) { policy.require("projectInit", "createFromApplication", "Role cannot init project"); return projects.fromApplication(body); }

    @GetMapping("/projects/{projectId}/context") public Map<String, Object> context(@PathVariable String projectId, @RequestParam String scope) { return projects.context(projectId, scope); }
    @PostMapping("/projects/{projectId}/context-building-details/save") public Map<String, Object> contextBuildingSave(@PathVariable String projectId, @RequestBody Map<String,Object> body) { policy.require("projectExtended", "mutate", "Role cannot mutate project context"); return projects.contextBuildingSave(projectId, body); }
    @PostMapping("/projects/{projectId}/context-meta/save") public Map<String, Object> contextMetaSave(@PathVariable String projectId, @RequestBody Map<String,Object> body) { policy.require("projectExtended", "mutate", "Role cannot mutate project context"); return projects.contextMetaSave(projectId, body); }
    @PostMapping("/projects/{projectId}/step-block-statuses/save") public Map<String, Object> stepBlockStatusesSave(@PathVariable String projectId, @RequestBody Map<String,Object> body) { policy.require("projectExtended", "mutate", "Role cannot mutate project context"); return projects.stepBlockStatusesSave(projectId, body); }
    @GetMapping("/projects/{projectId}/context-registry-details") public Map<String, Object> contextRegistryDetails(@PathVariable String projectId) { return projects.contextRegistryDetails(projectId); }
    @GetMapping("/projects/{projectId}/passport") public Map<String, Object> passport(@PathVariable String projectId) { return projects.passport(projectId); }
    @PutMapping("/projects/{projectId}/passport") public Map<String, Object> updatePassport(@PathVariable String projectId, @RequestBody Map<String,Object> body) { policy.require("projectExtended", "mutate", "Role cannot update passport"); return projects.updatePassport(projectId, body); }
    @PutMapping("/projects/{projectId}/participants/{role}") public Map<String, Object> participants(@PathVariable String projectId, @PathVariable String role, @RequestBody Map<String,Object> body) { policy.require("projectExtended", "mutate", "Role cannot mutate participants"); return projects.participants(projectId, role, body); }
    @PostMapping("/projects/{projectId}/documents") public Map<String, Object> documents(@PathVariable String projectId, @RequestBody Map<String,Object> body) { policy.require("projectExtended", "mutate", "Role cannot mutate documents"); return projects.documents(projectId, body); }
    @DeleteMapping("/project-documents/{documentId}") public Map<String, Object> deleteDoc(@PathVariable String documentId) { policy.require("projectExtended", "mutate", "Role cannot mutate documents"); return projects.deleteDoc(documentId); }
    @DeleteMapping("/projects/{projectId}") public Map<String, Object> deleteProject(@PathVariable String projectId, @RequestParam(required = false) String scope) { policy.require("projectExtended", "deleteProject", "Role cannot delete project"); return projects.deleteProject(projectId); }

    @GetMapping("/projects/{projectId}/integration-status") public Map<String, Object> integrationStatus(@PathVariable String projectId) { return projects.integrationStatus(projectId); }
    @PutMapping("/projects/{projectId}/integration-status") public Map<String, Object> updateIntegrationStatus(@PathVariable String projectId, @RequestBody Map<String,Object> body) { policy.require("integration", "mutate", "Role cannot mutate integration"); return projects.updateIntegrationStatus(projectId, body); }
    @GetMapping("/projects/{projectId}/parking-counts") public Map<String, Object> parkingCounts(@PathVariable String projectId) { return projects.parkingCounts(projectId); }
    @GetMapping("/registry/buildings-summary") public Object buildingsSummary(@RequestParam Map<String,String> q) { return projects.buildingsSummary(); }

    @GetMapping("/projects/{projectId}/basements") public Object basements(@PathVariable String projectId) { return projects.basements(projectId); }
    @PutMapping("/basements/{basementId}/parking-levels/{level}") public Map<String, Object> updateBasementLevel(@PathVariable String basementId, @PathVariable Integer level, @RequestBody Map<String,Object> body) { return projects.updateBasementLevel(basementId, level, body); }

    @GetMapping("/projects/{projectId}/full-registry") public Map<String, Object> fullRegistry(@PathVariable String projectId) { return projects.fullRegistry(projectId); }
    @GetMapping("/projects/{projectId}/tep-summary") public Map<String, Object> tepSummary(@PathVariable String projectId) { return projects.tepSummary(projectId); }
}
