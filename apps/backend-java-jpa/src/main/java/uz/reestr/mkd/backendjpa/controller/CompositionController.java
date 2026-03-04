package uz.reestr.mkd.backendjpa.controller;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import java.util.List;
import com.fasterxml.jackson.databind.node.ObjectNode;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertUnitRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpdateFloorRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.BatchUpsertUnitsRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.PreviewReconcileByBlockRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.UpdateBlockConstructionRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.UpdateBlockEngineeringRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileEntrancesRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileFloorsRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileUnitsForBlockRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.UpdateFloorsBatchRequest;
import uz.reestr.mkd.backendjpa.service.CompositionJpaService;
import uz.reestr.mkd.backendjpa.service.RegistryJpaService;

@RestController
@RequestMapping("/api/v1")
public class CompositionController {

  private final RegistryJpaService registryJpaService;
  private final CompositionJpaService compositionJpaService;

  public CompositionController(RegistryJpaService registryJpaService, CompositionJpaService compositionJpaService) {
    this.registryJpaService = registryJpaService;
    this.compositionJpaService = compositionJpaService;
  }


  @PutMapping("/blocks/{blockId}/construction")
  public ResponseEntity<JsonNode> updateBlockConstruction(
      @PathVariable UUID blockId,
      @RequestBody UpdateBlockConstructionRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(compositionJpaService.updateBlockConstruction(blockId, request));
  }

  @PutMapping("/blocks/{blockId}/engineering")
  public ResponseEntity<JsonNode> updateBlockEngineering(
      @PathVariable UUID blockId,
      @RequestBody UpdateBlockEngineeringRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(compositionJpaService.updateBlockEngineering(blockId, request));
  }

  @PostMapping("/units/batch-upsert")
  public ResponseEntity<JsonNode> batchUpsertUnits(
      @RequestBody BatchUpsertUnitsRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    int updated = 0;
    if (request != null && request.unitsList() != null) {
      for (var unit : request.unitsList()) {
        registryJpaService.upsertUnit(new UpsertUnitRequest(
            unit.id(), unit.num(), unit.area(), unit.type(), unit.rooms(),
            unit.buildingId(), unit.blockId(), unit.floorId(), unit.entranceId()
        ));
        updated++;
      }
    }
    ObjectNode result = compositionJpaService.objectNode();
    result.put("updated", updated);
    return ResponseEntity.ok(result);
  }

  @PostMapping("/blocks/{blockId}/units/reconcile")
  public ResponseEntity<RegistryJpaService.ReconcileUnitsResult> reconcileUnitsForBlock(
      @PathVariable UUID blockId,
      @RequestBody ReconcileUnitsForBlockRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(registryJpaService.reconcileUnitsForBlock(blockId, request));
  }

  @PostMapping("/blocks/{blockId}/reconcile/preview")
  public ResponseEntity<JsonNode> previewReconcileByBlock(
      @PathVariable UUID blockId,
      @RequestBody PreviewReconcileByBlockRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    ObjectNode result = compositionJpaService.objectNode();
    List<JsonNode> units = registryJpaService.getUnits(blockId, request == null || request.options() == null ? null : request.options().floorIds());
    List<JsonNode> commonAreas = registryJpaService.getCommonAreas(blockId, request == null || request.options() == null ? null : request.options().floorIds());
    result.put("unitsCount", units.size());
    result.put("commonAreasCount", commonAreas.size());
    result.put("includeUnits", request != null && request.options() != null && Boolean.TRUE.equals(request.options().includeUnits()));
    result.put("includeCommonAreas", request != null && request.options() != null && Boolean.TRUE.equals(request.options().includeCommonAreas()));
    return ResponseEntity.ok(result);
  }

  @PutMapping("/floors/batch")
  public ResponseEntity<JsonNode> floorsBatch(
      @RequestBody UpdateFloorsBatchRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    int updated = 0;
    if (request != null && request.items() != null) {
      for (var item : request.items()) {
        if (item == null || item.id() == null) {
          continue;
        }
        registryJpaService.updateFloor(item.id(), new UpdateFloorRequest(item.updates()));
        updated++;
      }
    }
    ObjectNode result = compositionJpaService.objectNode();
    result.put("updated", updated);
    return ResponseEntity.ok(result);
  }

  @PostMapping("/blocks/{blockId}/floors/reconcile")
  public ResponseEntity<RegistryJpaService.ReconcileFloorsResult> reconcileFloors(
      @PathVariable UUID blockId,
      @RequestBody ReconcileFloorsRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(registryJpaService.reconcileFloors(blockId, request));
  }

  @PostMapping("/blocks/{blockId}/entrances/reconcile")
  public ResponseEntity<RegistryJpaService.ReconcileEntrancesResult> reconcileEntrances(
      @PathVariable UUID blockId,
      @RequestBody ReconcileEntrancesRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(registryJpaService.reconcileEntrances(blockId, request));
  }
}
