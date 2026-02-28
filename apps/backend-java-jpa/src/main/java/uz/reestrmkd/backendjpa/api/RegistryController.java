package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.RegistryJpaService;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class RegistryController {
    private final RegistryJpaService registry;

    @GetMapping("/blocks/{blockId}/floors") public Object floors(@PathVariable String blockId){ return registry.floors(blockId); }
    @PutMapping("/floors/{floorId}") public Map<String,Object> floor(@PathVariable String floorId, @RequestBody Map<String,Object> body){ return registry.updateFloor(floorId, body); }
    @PutMapping("/floors/batch")
    public Map<String,Object> floorsBatch(@RequestBody Map<String,Object> body){
        @SuppressWarnings("unchecked") List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return registry.updateFloorsBatch(items);
    }
    @PostMapping("/blocks/{blockId}/floors/reconcile")
    public Map<String,Object> floorsRec(@PathVariable String blockId, @RequestBody Map<String,Object> body){
        @SuppressWarnings("unchecked") List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return registry.reconcileFloors(blockId, items);
    }

    @GetMapping("/blocks/{blockId}/entrances") public Object entrances(@PathVariable String blockId){ return registry.entrances(blockId); }
    @PostMapping("/blocks/{blockId}/entrances/reconcile")
    public Map<String,Object> entrancesRec(@PathVariable String blockId, @RequestBody Map<String,Object> body){
        @SuppressWarnings("unchecked") List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return registry.reconcileEntrances(blockId, items);
    }
    @GetMapping("/blocks/{blockId}/entrance-matrix") public Map<String,Object> matrix(@PathVariable String blockId){ return Map.of("items", registry.entranceMatrix(blockId)); }
    @PutMapping("/blocks/{blockId}/entrance-matrix/cell") public Map<String,Object> matrixCell(@PathVariable String blockId, @RequestBody Map<String,Object> body){ return registry.upsertMatrixCell(blockId, body); }
    @PutMapping("/blocks/{blockId}/entrance-matrix/batch")
    public Map<String,Object> matrixBatch(@PathVariable String blockId, @RequestBody Map<String,Object> body){
        @SuppressWarnings("unchecked") List<Map<String, Object>> cells = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("cells", List.of());
        return registry.batchUpsertMatrixCells(blockId, cells);
    }
    @PostMapping("/blocks/{blockId}/reconcile/preview") public Map<String,Object> reconcilePreview(@PathVariable String blockId){ return registry.previewReconcileByBlock(blockId); }

    @GetMapping("/blocks/{blockId}/units") public Object units(@PathVariable String blockId){ return registry.units(blockId); }
    @GetMapping("/blocks/{blockId}/extensions") public Object extensions(@PathVariable String blockId){ return registry.listExtensions(blockId); }
    @PostMapping("/blocks/{blockId}/extensions") public Map<String,Object> upsertExtension(@PathVariable String blockId, @RequestBody Map<String,Object> body){ return registry.createExtension(blockId, body); }
    @PutMapping("/extensions/{extensionId}") public Map<String,Object> editExtension(@PathVariable String extensionId, @RequestBody Map<String,Object> body){ return registry.updateExtension(extensionId, body); }
    @DeleteMapping("/extensions/{extensionId}") public Map<String,Object> deleteExtension(@PathVariable String extensionId){ return registry.deleteExtension(extensionId); }
    @PostMapping("/units/upsert") public Map<String,Object> upsertUnit(@RequestBody Map<String,Object> body){ return registry.upsertUnit(body); }
    @PostMapping("/units/batch-upsert")
    public Map<String,Object> batch(@RequestBody Map<String,Object> body){
        @SuppressWarnings("unchecked") List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", body.getOrDefault("unitsList", List.of()));
        return registry.batchUpsertUnits(items);
    }
    @PostMapping("/blocks/{blockId}/units/reconcile")
    public Map<String,Object> recUnits(@PathVariable String blockId, @RequestBody Map<String,Object> body){
        @SuppressWarnings("unchecked") List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", body.getOrDefault("unitsList", List.of()));
        return registry.reconcileUnits(blockId, items);
    }
    @GetMapping("/units/{unitId}/explication") public Map<String,Object> expl(@PathVariable String unitId){ return Map.of("items", registry.explication(unitId)); }
    @PostMapping("/floors/{floorId}/parking-places/sync")
    public Map<String,Object> sync(@PathVariable String floorId, @RequestBody Map<String,Object> body){
        @SuppressWarnings("unchecked") List<Map<String, Object>> places = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("places", List.of());
        return registry.syncParkingPlaces(floorId, places);
    }

    @GetMapping("/blocks/{blockId}/common-areas") public Object common(@PathVariable String blockId){ return registry.commonAreas(blockId); }
    @PostMapping("/common-areas/upsert") public Map<String,Object> upsertCommon(@RequestBody Map<String,Object> body){ return registry.upsertCommonArea(body); }
    @DeleteMapping("/common-areas/{id}") public Map<String,Object> del(@PathVariable String id){ return registry.deleteCommonArea(id); }
    @PostMapping("/blocks/{blockId}/common-areas/reconcile")
    public Map<String,Object> commonRec(@PathVariable String blockId, @RequestBody Map<String,Object> body){
        @SuppressWarnings("unchecked") List<Map<String, Object>> items = body == null ? List.of() : (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return registry.reconcileCommonAreas(blockId, items);
    }
    @PostMapping("/blocks/{blockId}/common-areas/clear") public Map<String,Object> clear(@PathVariable String blockId){ return registry.clearCommonAreas(blockId); }
}
