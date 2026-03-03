package uz.reestr.mkd.backendjpa.controller;

import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.BatchUpsertMatrixCellsRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.CreateBlockExtensionRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpdateBlockExtensionRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpdateFloorRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertCommonAreaRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertMatrixCellRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertUnitRequest;
import uz.reestr.mkd.backendjpa.service.RegistryJpaService;

@RestController
@RequestMapping("/api/v1")
public class RegistryController {

  private final RegistryJpaService registryJpaService;

  public RegistryController(RegistryJpaService registryJpaService) {
    this.registryJpaService = registryJpaService;
  }

  @GetMapping("/blocks/{blockId}/extensions")
  public ResponseEntity<Void> getBlockExtensions(@PathVariable UUID blockId) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/blocks/{blockId}/extensions")
  public ResponseEntity<Void> createBlockExtension(
      @PathVariable UUID blockId,
      @RequestBody CreateBlockExtensionRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/extensions/{extensionId}")
  public ResponseEntity<Void> updateBlockExtension(
      @PathVariable UUID extensionId,
      @RequestBody UpdateBlockExtensionRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/extensions/{extensionId}")
  public ResponseEntity<Void> deleteBlockExtension(@PathVariable UUID extensionId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/blocks/{blockId}/floors")
  public ResponseEntity<Void> getFloors(@PathVariable UUID blockId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/blocks/{blockId}/entrances")
  public ResponseEntity<Void> getEntrances(@PathVariable UUID blockId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/blocks/{blockId}/entrance-matrix")
  public ResponseEntity<Void> getEntranceMatrix(@PathVariable UUID blockId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/units/{unitId}/explication")
  public ResponseEntity<Void> getUnitExplicationById(@PathVariable UUID unitId) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/blocks/{blockId}/units")
  public ResponseEntity<Void> getUnits(
      @PathVariable UUID blockId,
      @RequestParam(required = false) List<UUID> floorIds
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/blocks/{blockId}/common-areas")
  public ResponseEntity<Void> getCommonAreas(
      @PathVariable UUID blockId,
      @RequestParam(required = false) List<UUID> floorIds
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/units/upsert")
  public ResponseEntity<Void> upsertUnit(
      @RequestBody UpsertUnitRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/common-areas/upsert")
  public ResponseEntity<Void> upsertCommonArea(
      @RequestBody UpsertCommonAreaRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/common-areas/{id}")
  public ResponseEntity<Void> deleteCommonArea(@PathVariable UUID id) {
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/floors/{floorId}")
  public ResponseEntity<Void> updateFloor(
      @PathVariable UUID floorId,
      @RequestBody UpdateFloorRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/blocks/{blockId}/entrance-matrix/cell")
  public ResponseEntity<Void> updateEntranceMatrixCell(
      @PathVariable UUID blockId,
      @RequestBody UpsertMatrixCellRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    registryJpaService.upsertEntranceMatrixCell(blockId, request);
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/blocks/{blockId}/entrance-matrix/batch")
  public ResponseEntity<RegistryJpaService.BatchMatrixResult> batchUpsertMatrixCells(
      @PathVariable UUID blockId,
      @RequestBody BatchUpsertMatrixCellsRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(registryJpaService.batchUpsertEntranceMatrixCells(blockId, request));
  }
}
