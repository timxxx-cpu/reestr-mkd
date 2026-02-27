package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.JpaFacadeService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class CompositionController {
    private final JpaFacadeService facade;

    @GetMapping("/projects/{projectId}/buildings") public Object buildings(@PathVariable String projectId){ return facade.nativeList("buildings", "project_id", projectId); }
    @PostMapping("/projects/{projectId}/buildings") public Map<String,Object> create(@PathVariable String projectId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @PutMapping("/buildings/{buildingId}") public Map<String,Object> update(@PathVariable String buildingId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @DeleteMapping("/buildings/{buildingId}") public Map<String,Object> delete(@PathVariable String buildingId){ return facade.ok(); }
    @PutMapping("/buildings/{buildingId}/cadastre") public Map<String,Object> buildingCadastre(@PathVariable String buildingId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @PutMapping("/units/{unitId}/cadastre") public Map<String,Object> unitCadastre(@PathVariable String unitId, @RequestBody Map<String,Object> body){ return facade.ok(); }
}
