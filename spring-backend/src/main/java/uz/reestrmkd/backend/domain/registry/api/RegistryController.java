package uz.reestrmkd.backend.domain.registry.api;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.common.api.ItemsResponseDto;
import uz.reestrmkd.backend.domain.common.api.MapResponseDto;
import uz.reestrmkd.backend.domain.registry.model.BlockExtensionEntity;
import uz.reestrmkd.backend.domain.registry.service.ParkingSyncService;
import uz.reestrmkd.backend.domain.registry.service.BlockExtensionService;
import uz.reestrmkd.backend.domain.registry.service.CreateExtensionCommand;
import uz.reestrmkd.backend.domain.registry.service.BlockStructureQueryService;
import uz.reestrmkd.backend.domain.registry.service.FloorsUpdateService;
import uz.reestrmkd.backend.domain.registry.service.RegistryBlockUnitsQueryService;
import uz.reestrmkd.backend.domain.registry.service.RegistryQueryService;
import uz.reestrmkd.backend.domain.registry.service.RegistryUnitQueryService;
import uz.reestrmkd.backend.domain.registry.service.RegistryMutationsService;
import uz.reestrmkd.backend.domain.registry.service.RegistryReconcileService;
import uz.reestrmkd.backend.domain.registry.service.RegistryCommonAreasService;
import uz.reestrmkd.backend.domain.registry.service.RegistryEntranceMatrixService;
import uz.reestrmkd.backend.domain.registry.service.ReconcilePreviewService;
import uz.reestrmkd.backend.domain.registry.service.UpdateExtensionCommand;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.security.CurrentUser;
import uz.reestrmkd.backend.security.PolicyGuard;

import java.util.*;

@RestController
@RequestMapping("/api/v1")
@Validated
@PolicyGuard(domain = "registry", action = "read", message = "Role cannot read registry data")
public class RegistryController {
    private final SecurityPolicyService securityPolicyService;
    private final ParkingSyncService parkingSyncService;
    private final RegistryQueryService registryQueryService;
    private final RegistryUnitQueryService registryUnitQueryService;
    private final RegistryBlockUnitsQueryService registryBlockUnitsQueryService;
    private final RegistryMutationsService registryMutationsService;
    private final RegistryReconcileService registryReconcileService;
    private final ReconcilePreviewService reconcilePreviewService;
    private final FloorsUpdateService floorsUpdateService;
    private final BlockStructureQueryService blockStructureQueryService;
    private final BlockExtensionService blockExtensionService;
    private final RegistryCommonAreasService registryCommonAreasService;
    private final RegistryEntranceMatrixService registryEntranceMatrixService;

    public RegistryController(
        SecurityPolicyService securityPolicyService,
        ParkingSyncService parkingSyncService,
        RegistryQueryService registryQueryService,
        RegistryUnitQueryService registryUnitQueryService,
        RegistryBlockUnitsQueryService registryBlockUnitsQueryService,
        ReconcilePreviewService reconcilePreviewService,
        FloorsUpdateService floorsUpdateService,
        RegistryMutationsService registryMutationsService,
        RegistryReconcileService registryReconcileService,
        BlockStructureQueryService blockStructureQueryService,
        BlockExtensionService blockExtensionService,
        RegistryCommonAreasService registryCommonAreasService,
        RegistryEntranceMatrixService registryEntranceMatrixService
    ) {
        this.securityPolicyService = securityPolicyService;
        this.parkingSyncService = parkingSyncService;
        this.registryQueryService = registryQueryService;
        this.registryUnitQueryService = registryUnitQueryService;
        this.registryBlockUnitsQueryService = registryBlockUnitsQueryService;
        this.reconcilePreviewService = reconcilePreviewService;
        this.floorsUpdateService = floorsUpdateService;
        this.registryMutationsService = registryMutationsService;
        this.registryReconcileService = registryReconcileService;
        this.blockStructureQueryService = blockStructureQueryService;
        this.blockExtensionService = blockExtensionService;
        this.registryCommonAreasService = registryCommonAreasService;
        this.registryEntranceMatrixService = registryEntranceMatrixService;
    }

    @GetMapping("/registry/buildings-summary")
    public List<Map<String, Object>> buildingsSummary(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer limit
    ) {
        return registryQueryService.loadBuildingsSummary(search, page, limit);
    }

    @GetMapping("/projects/{projectId}/parking-counts")
    public MapResponseDto parkingCounts(@PathVariable @NonNull UUID projectId) {
        return MapResponseDto.of(new HashMap<>(registryQueryService.loadParkingCounts(projectId)));
    }

    @PostMapping("/floors/{floorId}/parking-places/sync")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto syncParking(
        @PathVariable @NonNull UUID floorId,
        @RequestBody(required = false) @Valid SyncParkingPlacesRequestDto payload,
        @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        int targetCount = payload == null || payload.targetCount() == null ? 0 : payload.targetCount();
        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, targetCount);
        return MapResponseDto.of(Map.of("ok", true, "added", result.added(), "removed", result.removed()));
    }

    @GetMapping("/blocks/{blockId}/floors")
    public ItemsResponseDto getFloors(@PathVariable @NonNull UUID blockId) {
        return new ItemsResponseDto(blockStructureQueryService.listFloors(blockId));
    }

    @GetMapping("/blocks/{blockId}/entrances")
    public ItemsResponseDto getEntrances(@PathVariable @NonNull UUID blockId) {
        return new ItemsResponseDto(blockStructureQueryService.listEntrances(blockId));
    }

    @GetMapping("/blocks/{blockId}/extensions")
    public List<BlockExtensionEntity> getExtensions(@PathVariable @NonNull UUID blockId) {
        return blockExtensionService.listByBlock(blockId);
    }

    @PostMapping("/blocks/{blockId}/extensions")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public BlockExtensionEntity createExtension(@PathVariable @NonNull UUID blockId, @RequestBody(required = false) @Valid CreateExtensionRequestDto payload) {
        CreateExtensionCommand command = payload == null
            ? new CreateExtensionCommand(null, null, null, null, null, null, null, null, null)
            : payload.toCommand();
        return blockExtensionService.create(blockId, command);
    }

    @PutMapping("/extensions/{extensionId}")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto updateExt(@PathVariable @NonNull UUID extensionId, @RequestBody(required = false) @Valid UpdateExtensionRequestDto payload) {
        UpdateExtensionCommand command = payload == null
            ? new UpdateExtensionCommand(null, null, null)
            : payload.toCommand();
        blockExtensionService.update(extensionId, command);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @DeleteMapping("/extensions/{extensionId}")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto delExt(@PathVariable @NonNull UUID extensionId) {
        blockExtensionService.delete(extensionId);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @GetMapping("/units/{unitId}/explication")
    public ResponseEntity<?> explication(@PathVariable @NonNull UUID unitId) {
        Map<String, Object> result = registryUnitQueryService.loadUnitExplication(unitId);
        if (result == null) {
            return ResponseEntity.ok().body(null);
        }
        return ResponseEntity.ok(MapResponseDto.of(result));
    }

    @GetMapping("/blocks/{blockId}/units")
    public MapResponseDto units(
        @PathVariable @NonNull UUID blockId,
        @RequestParam(required = false) String floorIds,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String building,
        @RequestParam(required = false) String floor,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer limit
    ) {
        return MapResponseDto.of(
            registryBlockUnitsQueryService.loadUnits(blockId, floorIds, search, type, building, floor, page, limit)
        );
    }

    @PostMapping("/units/upsert")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto upsertUnit(@RequestBody(required = false) @Valid UpsertUnitRequestDto payload, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> data = payload == null ? Map.of() : payload.safeData();
        UUID unitId = registryMutationsService.upsertUnit(data);
        return MapResponseDto.of(Map.of("ok", true, "id", unitId));
    }

    @PostMapping("/blocks/{blockId}/units/reconcile")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto reconcileUnits(@PathVariable @NonNull UUID blockId, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        var result = registryMutationsService.reconcileUnits(blockId);
        return MapResponseDto.of(Map.of(
            "removed", result.removed(),
            "added", result.added(),
            "checkedCells", result.checkedCells()
        ));
    }

    @PostMapping("/blocks/{blockId}/common-areas/reconcile")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto reconcileMops(@PathVariable @NonNull UUID blockId, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        var result = registryMutationsService.reconcileMops(blockId);
        return MapResponseDto.of(Map.of("removed", result.removed(), "checkedCells", result.checkedCells()));
    }

    @PostMapping("/units/batch-upsert")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto batchUpsertUnits(@RequestBody(required = false) @Valid BatchUpsertUnitsRequestDto payload, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        List<Map<String, Object>> items = payload == null ? List.of() : payload.resolveItems();
        int count = registryMutationsService.batchUpsertUnits(items);
        return MapResponseDto.of(Map.of("ok", true, "count", count));
    }

    @PostMapping("/common-areas/upsert")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto upsertCommon(@RequestBody(required = false) @Valid UpsertCommonAreaRequestDto payload) {
        Map<String, Object> data = payload == null ? Map.of() : payload.safeData();
        registryCommonAreasService.upsert(data);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @PostMapping("/common-areas/batch-upsert")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto batchUpsertMops(@RequestBody(required = false) @Valid BatchUpsertCommonAreasRequestDto payload) {
        List<Map<String, Object>> items = payload == null ? List.of() : payload.resolveItems();
        int count = registryCommonAreasService.batchUpsert(items);
        return MapResponseDto.of(Map.of("ok", true, "count", count));
    }

    @DeleteMapping("/common-areas/{id}")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto deleteCommon(@PathVariable @NonNull UUID id) {
        registryCommonAreasService.delete(id);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @PostMapping("/blocks/{blockId}/common-areas/clear")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto clearCommon(@PathVariable @NonNull UUID blockId, @RequestBody(required = false) @Valid ClearCommonAreasRequestDto payload) {
        String floorIds = payload == null ? "" : payload.safeFloorIds();
        registryCommonAreasService.clear(blockId, floorIds);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @GetMapping("/blocks/{blockId}/common-areas")
    public ItemsResponseDto commonAreas(@PathVariable @NonNull UUID blockId, @RequestParam(required = false) String floorIds) {
        return new ItemsResponseDto(registryCommonAreasService.list(blockId, floorIds));
    }

    @GetMapping("/blocks/{blockId}/entrance-matrix")
    public ItemsResponseDto matrix(@PathVariable @NonNull UUID blockId) {
        return new ItemsResponseDto(registryEntranceMatrixService.listByBlock(blockId));
    }

    @PutMapping("/floors/{floorId}")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto updateFloor(@PathVariable @NonNull UUID floorId, @RequestBody(required = false) @Valid UpdateFloorRequestDto payload, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> updates = payload == null ? Map.of() : payload.safeUpdates();
        return MapResponseDto.of(floorsUpdateService.updateFloor(floorId, updates));
    }

    @PutMapping("/floors/batch")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto updateFloorsBatch(@RequestBody(required = false) @Valid UpdateFloorsBatchRequestDto payload, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        List<Map<String, Object>> items = payload == null ? List.of() : payload.safeItems();
        boolean strict = payload != null && payload.safeStrict();
        return MapResponseDto.of(floorsUpdateService.updateFloorsBatch(items, strict));
    }


    @PostMapping("/blocks/{blockId}/floors/reconcile")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto reconcileFloors(@PathVariable @NonNull UUID blockId, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        var result = registryReconcileService.reconcileFloors(blockId);
        return MapResponseDto.of(Map.of("ok", true, "deleted", result.deleted(), "upserted", result.upserted()));
    }

    @PostMapping("/blocks/{blockId}/entrances/reconcile")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto reconcileEntrances(
        @PathVariable @NonNull UUID blockId,
        @RequestBody(required = false) @Valid ReconcileEntrancesRequestDto payload,
        @CurrentUser ActorPrincipal actor
    ) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        int count = payload == null || payload.count() == null ? 0 : payload.count();

        var result = registryReconcileService.reconcileEntrances(blockId, count);
        return MapResponseDto.of(Map.of(
            "ok", true,
            "count", result.count(),
            "created", result.created(),
            "deleted", result.deleted()
        ));
    }

   @PutMapping("/blocks/{blockId}/entrance-matrix/cell")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto upsertCell(@PathVariable @NonNull UUID blockId, @RequestBody(required = false) @Valid UpsertEntranceMatrixCellRequestDto payload, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> body = payload == null ? Map.of() : payload.safeData();
        return MapResponseDto.of(registryEntranceMatrixService.upsertCell(blockId, body));
    }

   @PutMapping("/blocks/{blockId}/entrance-matrix/batch")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot modify registry data")
    public MapResponseDto upsertMatrixBatch(@PathVariable @NonNull UUID blockId, @RequestBody(required = false) @Valid UpsertEntranceMatrixBatchRequestDto payload, @CurrentUser ActorPrincipal actor) {
        requirePolicy(actor, "registry", "mutate", "Role cannot modify registry data");
        List<Map<String, Object>> cells = payload == null ? List.of() : payload.safeCells();
        return MapResponseDto.of(registryEntranceMatrixService.upsertBatch(blockId, cells));
    }
    
    @PostMapping("/blocks/{blockId}/reconcile/preview")
    @PolicyGuard(domain = "registry", action = "mutate", message = "Role cannot preview registry reconciliation")
    public ResponseEntity<MapResponseDto> preview(@PathVariable @NonNull UUID blockId) {
        return ResponseEntity.ok(MapResponseDto.of(reconcilePreviewService.preview(blockId)));
    }


    private void requirePolicy(ActorPrincipal actor, String module, String action, String message) {
        if (actor == null) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRoleId(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}
