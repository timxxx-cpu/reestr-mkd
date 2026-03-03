package uz.reestr.mkd.backendjpa.controller;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.BatchUpsertUnitsRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ClearCommonAreasRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.PreviewReconcileByBlockRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileCommonAreasForBlockRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileEntrancesRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileFloorsRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileUnitsForBlockRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.UpdateFloorsBatchRequest;
import uz.reestr.mkd.backendjpa.service.RegistryJpaService;

@RestController
@RequestMapping("/api/v1")
public class CompositionController {

  private final RegistryJpaService registryJpaService;

  public CompositionController(RegistryJpaService registryJpaService) {
    this.registryJpaService = registryJpaService;
  }

  @PostMapping("/units/batch-upsert")
  public ResponseEntity<Void> batchUpsertUnits(
      @RequestBody BatchUpsertUnitsRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/blocks/{blockId}/units/reconcile")
  public ResponseEntity<RegistryJpaService.ReconcileUnitsResult> reconcileUnitsForBlock(
      @PathVariable UUID blockId,
      @RequestBody ReconcileUnitsForBlockRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(registryJpaService.reconcileUnitsForBlock(blockId, request));
  }

  @PostMapping("/blocks/{blockId}/common-areas/reconcile")
  public ResponseEntity<Void> reconcileCommonAreasForBlock(
      @PathVariable UUID blockId,
      @RequestBody ReconcileCommonAreasForBlockRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/blocks/{blockId}/reconcile/preview")
  public ResponseEntity<Void> previewReconcileByBlock(
      @PathVariable UUID blockId,
      @RequestBody PreviewReconcileByBlockRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/blocks/{blockId}/common-areas/clear")
  public ResponseEntity<Void> clearCommonAreas(
      @PathVariable UUID blockId,
      @RequestBody ClearCommonAreasRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/floors/batch")
  public ResponseEntity<Void> floorsBatch(
      @RequestBody UpdateFloorsBatchRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
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
  public ResponseEntity<Void> reconcileEntrances(
      @PathVariable UUID blockId,
      @RequestBody ReconcileEntrancesRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }
}
