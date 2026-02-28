package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.CompositionJpaService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class CompositionController {
    private final CompositionJpaService service;

    @GetMapping("/projects/{projectId}/buildings") public Object buildings(@PathVariable String projectId){ return service.listBuildings(projectId); }
    @PostMapping("/projects/{projectId}/buildings") public Map<String,Object> create(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return service.createBuilding(projectId, body); }
    @PutMapping("/buildings/{buildingId}") public Map<String,Object> update(@PathVariable String buildingId, @RequestBody Map<String,Object> body){ return service.updateBuilding(buildingId, body); }
    @DeleteMapping("/buildings/{buildingId}") public Map<String,Object> delete(@PathVariable String buildingId){ return service.deleteBuilding(buildingId); }
    @PutMapping("/buildings/{buildingId}/cadastre") public Map<String,Object> buildingCadastre(@PathVariable String buildingId, @RequestBody Map<String,Object> body){ return service.updateBuildingCadastre(buildingId, body); }
    @PutMapping("/units/{unitId}/cadastre") public Map<String,Object> unitCadastre(@PathVariable String unitId, @RequestBody Map<String,Object> body){ return service.updateUnitCadastre(unitId, body); }
}
