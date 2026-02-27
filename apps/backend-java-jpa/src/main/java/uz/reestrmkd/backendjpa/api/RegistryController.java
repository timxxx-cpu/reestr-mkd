package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.JpaFacadeService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class RegistryController {
    private final JpaFacadeService facade;

    @GetMapping("/blocks/{blockId}/floors") public Object floors(@PathVariable String blockId){ return facade.nativeList("floors", "block_id", blockId); }
    @PutMapping("/floors/{floorId}") public Map<String,Object> floor(@PathVariable String floorId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/blocks/{blockId}/floors/reconcile") public Map<String,Object> floorsRec(@PathVariable String blockId, @RequestBody Map<String,Object> body){ return facade.ok(); }

    @GetMapping("/blocks/{blockId}/entrances") public Object entrances(@PathVariable String blockId){ return facade.nativeList("entrances", "block_id", blockId); }
    @PostMapping("/blocks/{blockId}/entrances/reconcile") public Map<String,Object> entrancesRec(@PathVariable String blockId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @GetMapping("/blocks/{blockId}/entrance-matrix") public Map<String,Object> matrix(@PathVariable String blockId){ return facade.ok(); }
    @PutMapping("/blocks/{blockId}/entrance-matrix/cell") public Map<String,Object> matrixCell(@PathVariable String blockId, @RequestBody Map<String,Object> body){ return facade.ok(); }

    @GetMapping("/blocks/{blockId}/units") public Object units(@PathVariable String blockId){ return facade.ok(); }
    @PostMapping("/units/upsert") public Map<String,Object> upsertUnit(@RequestBody Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/units/batch-upsert") public Map<String,Object> batch(@RequestBody Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/blocks/{blockId}/units/reconcile") public Map<String,Object> recUnits(@PathVariable String blockId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @GetMapping("/units/{unitId}/explication") public Map<String,Object> expl(@PathVariable String unitId){ return facade.ok(); }
    @PostMapping("/floors/{floorId}/parking-places/sync") public Map<String,Object> sync(@PathVariable String floorId, @RequestBody Map<String,Object> body){ return facade.ok(); }

    @GetMapping("/blocks/{blockId}/common-areas") public Object common(@PathVariable String blockId){ return facade.nativeList("common_areas", "block_id", blockId); }
    @PostMapping("/common-areas/upsert") public Map<String,Object> upsertCommon(@RequestBody Map<String,Object> body){ return facade.ok(); }
    @DeleteMapping("/common-areas/{id}") public Map<String,Object> del(@PathVariable String id){ return facade.ok(); }
    @PostMapping("/blocks/{blockId}/common-areas/reconcile") public Map<String,Object> commonRec(@PathVariable String blockId, @RequestBody Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/blocks/{blockId}/common-areas/clear") public Map<String,Object> clear(@PathVariable String blockId){ return facade.ok(); }
}
