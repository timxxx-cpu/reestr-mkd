package uz.reestrmkd.backend.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.application.RegistryService;
import uz.reestrmkd.backend.security.PolicyService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class RegistryController {
    private final RegistryService registry;
    private final PolicyService policy;

    public RegistryController(RegistryService registry, PolicyService policy) {
        this.registry = registry;
        this.policy = policy;
    }

    @GetMapping("/blocks/{blockId}/floors")
    public List<Map<String, Object>> floors(@PathVariable String blockId) { return registry.floors(blockId); }

    @PutMapping("/floors/{floorId}")
    public Map<String, Object> updateFloor(@PathVariable String floorId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.updateFloor(floorId, body);
    }

    @PutMapping("/floors/batch")
    public Map<String, Object> updateFloorsBatch(@RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        boolean strict = body != null && Boolean.TRUE.equals(body.get("strict"));
        return registry.updateFloorsBatch(items, strict);
    }

    @PostMapping("/blocks/{blockId}/floors/reconcile")
    public Map<String, Object> reconcileFloors(@PathVariable String blockId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return registry.reconcileFloors(blockId, items);
    }

    @GetMapping("/blocks/{blockId}/entrances")
    public List<Map<String, Object>> entrances(@PathVariable String blockId) { return registry.entrances(blockId); }

    @PostMapping("/blocks/{blockId}/entrances/reconcile")
    public Map<String, Object> reconcileEntrances(@PathVariable String blockId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return registry.reconcileEntrances(blockId, items);
    }

    @GetMapping("/blocks/{blockId}/entrance-matrix")
    public List<Map<String, Object>> entranceMatrix(@PathVariable String blockId) {
        return registry.entranceMatrix(blockId);
    }

    @PutMapping("/blocks/{blockId}/entrance-matrix/cell")
    public Map<String, Object> entranceCell(@PathVariable String blockId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.updateEntranceMatrixCell(blockId, body);
    }

    @PutMapping("/blocks/{blockId}/entrance-matrix/batch")
    public Map<String, Object> entranceBatch(@PathVariable String blockId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        List<Map<String, Object>> cells = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("cells", List.of());
        return registry.batchUpsertMatrixCells(blockId, cells);
    }

    @PostMapping("/blocks/{blockId}/reconcile/preview")
    public Map<String, Object> previewReconcile(@PathVariable String blockId) {
        return registry.previewReconcileByBlock(blockId);
    }

    @GetMapping("/blocks/{blockId}/extensions")
    public List<Map<String, Object>> extensions(@PathVariable String blockId) {
        return registry.listExtensions(blockId);
    }

    @PostMapping("/blocks/{blockId}/extensions")
    public Map<String, Object> createExtension(@PathVariable String blockId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.createExtension(blockId, body);
    }

    @PutMapping("/extensions/{extensionId}")
    public Map<String, Object> updateExtension(@PathVariable String extensionId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.updateExtension(extensionId, body);
    }

    @DeleteMapping("/extensions/{extensionId}")
    public Map<String, Object> deleteExtension(@PathVariable String extensionId) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.deleteExtension(extensionId);
    }

    @GetMapping("/blocks/{blockId}/units")
    public Map<String, Object> units(@PathVariable String blockId) { return registry.units(blockId); }

    @PostMapping("/units/upsert")
    public Map<String, Object> upsertUnit(@RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.upsertUnit(body);
    }

    @PostMapping("/units/batch-upsert")
    public Map<String, Object> batchUpsertUnit(@RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", body.getOrDefault("unitsList", List.of()));
        return registry.batchUpsertUnits(items);
    }

    @PostMapping("/blocks/{blockId}/units/reconcile")
    public Map<String, Object> reconcileUnits(@PathVariable String blockId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", body.getOrDefault("unitsList", List.of()));
        return registry.reconcileUnits(blockId, items);
    }

    @GetMapping("/units/{unitId}/explication")
    public Map<String, Object> explication(@PathVariable String unitId) {
        return Map.of("items", registry.explication(unitId));
    }

    @PostMapping("/floors/{floorId}/parking-places/sync")
    public Map<String, Object> syncParkingPlaces(@PathVariable String floorId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        List<Map<String, Object>> places = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return registry.syncParkingPlaces(floorId, places);
    }

    @GetMapping("/blocks/{blockId}/common-areas")
    public List<Map<String, Object>> commonAreas(@PathVariable String blockId) { return registry.commonAreas(blockId); }

    @PostMapping("/common-areas/upsert")
    public Map<String, Object> upsertCommonArea(@RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.upsertCommonArea(body);
    }

    @DeleteMapping("/common-areas/{id}")
    public Map<String, Object> deleteCommonArea(@PathVariable String id) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.deleteCommonArea(id);
    }

    @PostMapping("/blocks/{blockId}/common-areas/reconcile")
    public Map<String, Object> reconcileCommonAreas(@PathVariable String blockId, @RequestBody Map<String, Object> body) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return registry.reconcileCommonAreas(blockId, items);
    }

    @PostMapping("/blocks/{blockId}/common-areas/clear")
    public Map<String, Object> clearCommonAreas(@PathVariable String blockId) {
        policy.require("registry", "mutate", "Role cannot mutate registry");
        return registry.clearCommonAreas(blockId);
    }
}
