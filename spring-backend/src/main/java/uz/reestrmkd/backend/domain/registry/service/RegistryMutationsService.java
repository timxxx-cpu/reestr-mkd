package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RegistryMutationsService {
    private final UnitService unitService;
    private final UnitsReconcileService unitsReconcileService;
    private final MopsReconcileService mopsReconcileService;

    public RegistryMutationsService(
        UnitService unitService,
        UnitsReconcileService unitsReconcileService,
        MopsReconcileService mopsReconcileService
    ) {
        this.unitService = unitService;
        this.unitsReconcileService = unitsReconcileService;
        this.mopsReconcileService = mopsReconcileService;
    }

    public UUID upsertUnit(Map<String, Object> data) {
        return unitService.upsertUnit(data);
    }

    public int batchUpsertUnits(List<Map<String, Object>> items) {
        return unitService.batchUpsertUnits(items);
    }

    public UnitsReconcileService.UnitsReconcileResult reconcileUnits(UUID blockId) {
        return unitsReconcileService.reconcile(blockId);
    }

    public MopsReconcileService.MopsReconcileResult reconcileMops(UUID blockId) {
        return mopsReconcileService.reconcile(blockId);
    }
}
