package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class RegistryReconcileService {
    private final FloorsReconcileService floorsReconcileService;
    private final EntranceReconcileService entranceReconcileService;
    private final EntranceMatrixEnsureService entranceMatrixEnsureService;

    public RegistryReconcileService(
        FloorsReconcileService floorsReconcileService,
        EntranceReconcileService entranceReconcileService,
        EntranceMatrixEnsureService entranceMatrixEnsureService
    ) {
        this.floorsReconcileService = floorsReconcileService;
        this.entranceReconcileService = entranceReconcileService;
        this.entranceMatrixEnsureService = entranceMatrixEnsureService;
    }

    public FloorsReconcileService.FloorsReconcileResult reconcileFloors(UUID blockId) {
        FloorsReconcileService.FloorsReconcileResult result = floorsReconcileService.reconcile(blockId);
        entranceMatrixEnsureService.ensureForBlock(blockId);
        return result;
    }

    public EntranceReconcileService.EntranceReconcileResult reconcileEntrances(UUID blockId, int count) {
        EntranceReconcileService.EntranceReconcileResult result = entranceReconcileService.reconcile(blockId, count);
        entranceMatrixEnsureService.ensureForBlock(blockId);
        return result;
    }
}
