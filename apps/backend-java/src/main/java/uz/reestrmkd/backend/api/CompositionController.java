package uz.reestrmkd.backend.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.application.CompositionService;
import uz.reestrmkd.backend.security.PolicyService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class CompositionController {
    private final CompositionService service;
    private final PolicyService policy;

    public CompositionController(CompositionService service, PolicyService policy) {
        this.service = service;
        this.policy = policy;
    }

    @GetMapping("/projects/{projectId}/buildings")
    public List<Map<String, Object>> getBuildings(@PathVariable String projectId) {
        return service.listBuildings(projectId);
    }

    @PostMapping("/projects/{projectId}/buildings")
    public Map<String, Object> createBuilding(@PathVariable String projectId, @RequestBody Map<String, Object> body) {
        policy.require("composition", "mutate", "Role cannot mutate composition");
        return service.createBuilding(projectId, body);
    }

    @PutMapping("/buildings/{buildingId}")
    public Map<String, Object> updateBuilding(@PathVariable String buildingId, @RequestBody Map<String, Object> body) {
        policy.require("composition", "mutate", "Role cannot mutate composition");
        return service.updateBuilding(buildingId, body);
    }

    @DeleteMapping("/buildings/{buildingId}")
    public Map<String, Object> deleteBuilding(@PathVariable String buildingId) {
        policy.require("composition", "mutate", "Role cannot mutate composition");
        return service.deleteBuilding(buildingId);
    }

    @PutMapping("/buildings/{buildingId}/cadastre")
    public Map<String, Object> updateBuildingCadastre(@PathVariable String buildingId, @RequestBody Map<String, Object> body) {
        policy.require("integration", "mutate", "Role cannot mutate integration");
        return service.updateBuildingCadastre(buildingId, body);
    }

    @PutMapping("/units/{unitId}/cadastre")
    public Map<String, Object> updateUnitCadastre(@PathVariable String unitId, @RequestBody Map<String, Object> body) {
        policy.require("integration", "mutate", "Role cannot mutate integration");
        return service.updateUnitCadastre(unitId, body);
    }
}
