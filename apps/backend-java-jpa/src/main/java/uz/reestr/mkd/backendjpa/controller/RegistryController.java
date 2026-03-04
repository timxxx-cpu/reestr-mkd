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
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ClearCommonAreasRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.CreateBlockExtensionRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpdateBlockExtensionRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpdateFloorRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertCommonAreaRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertMatrixCellRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertRoomRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertUnitRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.BatchUpsertMatrixCellsResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.BlockStructureResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.BlockExtensionMutationResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.BlockExtensionsResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.CommonAreasResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.ClearCommonAreasResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.EntranceMatrixResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.EntrancesResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.FloorsResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.ReconcileCommonAreasResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.RoomsResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.UnitExplicationResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.UnitsResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.UpdateFloorResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.UpsertCommonAreaResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.UpsertMatrixCellResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.UpsertRoomResponse;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.UpsertUnitResponse;
import uz.reestr.mkd.backendjpa.entity.EntranceMatrixEntity;
import uz.reestr.mkd.backendjpa.service.RegistryJpaService;

@RestController
@RequestMapping("/api/v1")
public class RegistryController {

  private final RegistryJpaService registryJpaService;

  public RegistryController(RegistryJpaService registryJpaService) {
    this.registryJpaService = registryJpaService;
  }

  @GetMapping("/blocks/{blockId}/extensions")
  public ResponseEntity<BlockExtensionsResponse> getBlockExtensions(@PathVariable UUID blockId) {
    return ResponseEntity.ok(new BlockExtensionsResponse(registryJpaService.getBlockExtensions(blockId)));
  }

  @PostMapping("/blocks/{blockId}/extensions")
  public ResponseEntity<BlockExtensionMutationResponse> createBlockExtension(
      @PathVariable UUID blockId,
      @RequestBody CreateBlockExtensionRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(new BlockExtensionMutationResponse(registryJpaService.createBlockExtension(blockId, request)));
  }

  @PutMapping("/extensions/{extensionId}")
  public ResponseEntity<BlockExtensionMutationResponse> updateBlockExtension(
      @PathVariable UUID extensionId,
      @RequestBody UpdateBlockExtensionRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(new BlockExtensionMutationResponse(registryJpaService.updateBlockExtension(extensionId, request)));
  }

  @DeleteMapping("/extensions/{extensionId}")
  public ResponseEntity<Void> deleteBlockExtension(@PathVariable UUID extensionId) {
    registryJpaService.deleteBlockExtension(extensionId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/blocks/{blockId}/floors")
  public ResponseEntity<FloorsResponse> getFloors(@PathVariable UUID blockId) {
    return ResponseEntity.ok(new FloorsResponse(registryJpaService.getFloors(blockId)));
  }

  @GetMapping("/blocks/{blockId}/entrances")
  public ResponseEntity<EntrancesResponse> getEntrances(@PathVariable UUID blockId) {
    return ResponseEntity.ok(new EntrancesResponse(registryJpaService.getEntrances(blockId)));
  }

  @GetMapping("/blocks/{blockId}/entrance-matrix")
  public ResponseEntity<EntranceMatrixResponse> getEntranceMatrix(@PathVariable UUID blockId) {
    return ResponseEntity.ok(new EntranceMatrixResponse(registryJpaService.getEntranceMatrix(blockId)));
  }

  @GetMapping("/units/{unitId}/explication")
  public ResponseEntity<UnitExplicationResponse> getUnitExplicationById(@PathVariable UUID unitId) {
    return ResponseEntity.ok(new UnitExplicationResponse(registryJpaService.getUnitExplication(unitId)));
  }

  @GetMapping("/units/{unitId}/rooms")
  public ResponseEntity<RoomsResponse> getRoomsByUnit(@PathVariable UUID unitId) {
    return ResponseEntity.ok(new RoomsResponse(registryJpaService.getRoomsByUnit(unitId)));
  }

  @PostMapping("/units/{unitId}/rooms")
  public ResponseEntity<UpsertRoomResponse> createRoom(
      @PathVariable UUID unitId,
      @RequestBody UpsertRoomRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(new UpsertRoomResponse(registryJpaService.upsertRoom(unitId, null, request)));
  }

  @PutMapping("/rooms/{roomId}")
  public ResponseEntity<UpsertRoomResponse> updateRoom(
      @PathVariable UUID roomId,
      @RequestBody UpsertRoomRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(new UpsertRoomResponse(registryJpaService.upsertRoom(null, roomId, request)));
  }

  @DeleteMapping("/rooms/{roomId}")
  public ResponseEntity<Void> deleteRoom(@PathVariable UUID roomId) {
    registryJpaService.deleteRoom(roomId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/blocks/{blockId}/units")
  public ResponseEntity<UnitsResponse> getUnits(
      @PathVariable UUID blockId,
      @RequestParam(required = false) List<UUID> floorIds
  ) {
    return ResponseEntity.ok(new UnitsResponse(registryJpaService.getUnits(blockId, floorIds)));
  }

  @GetMapping("/blocks/{blockId}/common-areas")
  public ResponseEntity<CommonAreasResponse> getCommonAreas(
      @PathVariable UUID blockId,
      @RequestParam(required = false) List<UUID> floorIds
  ) {
    return ResponseEntity.ok(new CommonAreasResponse(registryJpaService.getCommonAreas(blockId, floorIds)));
  }

  @GetMapping("/blocks/{blockId}/structure")
  public ResponseEntity<BlockStructureResponse> getBlockStructure(@PathVariable UUID blockId) {
    return ResponseEntity.ok(new BlockStructureResponse(registryJpaService.getBlockHierarchy(blockId)));
  }

  @PostMapping("/blocks/{blockId}/common-areas/reconcile")
  public ResponseEntity<ReconcileCommonAreasResponse> reconcileCommonAreasForBlock(
      @PathVariable UUID blockId,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    RegistryJpaService.ReconcileCommonAreasResult result = registryJpaService.reconcileCommonAreasForBlock(blockId);
    return ResponseEntity.ok(new ReconcileCommonAreasResponse(result.removed(), result.created(), result.checkedCells()));
  }

  @PostMapping("/units/upsert")
  public ResponseEntity<UpsertUnitResponse> upsertUnit(
      @RequestBody UpsertUnitRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(new UpsertUnitResponse(registryJpaService.upsertUnit(request)));
  }

  @PostMapping("/common-areas/upsert")
  public ResponseEntity<UpsertCommonAreaResponse> upsertCommonArea(
      @RequestBody UpsertCommonAreaRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(new UpsertCommonAreaResponse(registryJpaService.updateCommonArea(null, request)));
  }

  @PutMapping("/common-areas/{id}")
  public ResponseEntity<UpsertCommonAreaResponse> updateCommonArea(
      @PathVariable UUID id,
      @RequestBody UpsertCommonAreaRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(new UpsertCommonAreaResponse(registryJpaService.updateCommonArea(id, request)));
  }

  @DeleteMapping("/common-areas/{id}")
  public ResponseEntity<Void> deleteCommonArea(@PathVariable UUID id) {
    registryJpaService.clearCommonAreasForIds(List.of(id));
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/blocks/{blockId}/common-areas/clear")
  public ResponseEntity<ClearCommonAreasResponse> clearCommonAreas(
      @PathVariable UUID blockId,
      @RequestParam(required = false) List<UUID> floorIds,
      @RequestBody(required = false) ClearCommonAreasRequest body,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    List<UUID> resolvedFloorIds = floorIds;
    if ((resolvedFloorIds == null || resolvedFloorIds.isEmpty()) && body != null && body.floorIds() != null && !body.floorIds().isBlank()) {
      resolvedFloorIds = java.util.Arrays.stream(body.floorIds().split(","))
          .map(String::trim)
          .filter(v -> !v.isBlank())
          .map(UUID::fromString)
          .toList();
    }
    int deleted = registryJpaService.clearCommonAreas(blockId, resolvedFloorIds);
    return ResponseEntity.ok(new ClearCommonAreasResponse(true, deleted));
  }

  @PutMapping("/floors/{floorId}")
  public ResponseEntity<UpdateFloorResponse> updateFloor(
      @PathVariable UUID floorId,
      @RequestBody UpdateFloorRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(new UpdateFloorResponse(registryJpaService.updateFloor(floorId, request)));
  }

  @PutMapping("/blocks/{blockId}/entrance-matrix/cell")
  public ResponseEntity<UpsertMatrixCellResponse> updateEntranceMatrixCell(
      @PathVariable UUID blockId,
      @RequestBody UpsertMatrixCellRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    EntranceMatrixEntity entity = registryJpaService.upsertEntranceMatrixCell(blockId, request);
    return ResponseEntity.ok(new UpsertMatrixCellResponse(
        entity.getId(),
        entity.getFloor() == null ? null : entity.getFloor().getId(),
        entity.getEntranceNumber(),
        entity.getFlatsCount(),
        entity.getCommercialCount(),
        entity.getMopCount()
    ));
  }

  @PutMapping("/blocks/{blockId}/entrance-matrix/batch")
  public ResponseEntity<BatchUpsertMatrixCellsResponse> batchUpsertMatrixCells(
      @PathVariable UUID blockId,
      @RequestBody BatchUpsertMatrixCellsRequest request,
      @RequestHeader(value = "x-idempotency-key", required = false) String idempotencyKey
  ) {
    return ResponseEntity.ok(registryJpaService.batchUpsertEntranceMatrixCells(blockId, request));
  }
}
