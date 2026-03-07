package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.lang.NonNull;
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

    public FloorsReconcileService.FloorsReconcileResult reconcileFloors(@NonNull UUID blockId) {
        FloorsReconcileService.FloorsReconcileResult result = floorsReconcileService.reconcile(blockId);
        entranceMatrixEnsureService.ensureForBlock(blockId);
        return result;
    }

    public EntranceReconcileService.EntranceReconcileResult reconcileEntrances(@NonNull UUID blockId, int count) {
        EntranceReconcileService.EntranceReconcileResult result = entranceReconcileService.reconcile(blockId, count);
        entranceMatrixEnsureService.ensureForBlock(blockId);
        return result;
    }
}