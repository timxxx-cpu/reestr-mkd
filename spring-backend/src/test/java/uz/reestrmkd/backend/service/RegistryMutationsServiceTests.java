package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.service.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistryMutationsServiceTests {

    @Mock private UnitService unitService;
    @Mock private UnitsReconcileService unitsReconcileService;
    @Mock private MopsReconcileService mopsReconcileService;

    private RegistryMutationsService service;

    @BeforeEach
    void setUp() {
        service = new RegistryMutationsService(unitService, unitsReconcileService, mopsReconcileService);
    }

    @Test
    void shouldUpsertUnit() {
        UUID id = UUID.randomUUID();
        when(unitService.upsertUnit(Map.of("a", 1))).thenReturn(id);
        assertEquals(id, service.upsertUnit(Map.of("a", 1)));
    }

    @Test
    void shouldBatchUpsertUnits() {
        when(unitService.batchUpsertUnits(List.of(Map.of("k", "v")))).thenReturn(3);
        assertEquals(3, service.batchUpsertUnits(List.of(Map.of("k", "v"))));
    }

    @Test
    void shouldReconcileUnits() {
        UUID blockId = UUID.randomUUID();
        var expected = new UnitsReconcileService.UnitsReconcileResult(1, 2, 3);
        when(unitsReconcileService.reconcile(blockId)).thenReturn(expected);
        assertEquals(expected, service.reconcileUnits(blockId));
        verify(unitsReconcileService).reconcile(blockId);
    }

    @Test
    void shouldReconcileMops() {
        UUID blockId = UUID.randomUUID();
        var expected = new MopsReconcileService.MopsReconcileResult(4, 5);
        when(mopsReconcileService.reconcile(blockId)).thenReturn(expected);
        assertEquals(expected, service.reconcileMops(blockId));
        verify(mopsReconcileService).reconcile(blockId);
    }
}
