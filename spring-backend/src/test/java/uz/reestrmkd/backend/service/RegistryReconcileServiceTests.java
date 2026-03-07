package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.service.*;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class RegistryReconcileServiceTests {

    @Mock private FloorsReconcileService floorsReconcileService;
    @Mock private EntranceReconcileService entranceReconcileService;
    @Mock private EntranceMatrixEnsureService entranceMatrixEnsureService;

    private RegistryReconcileService service;

    @BeforeEach
    void setUp() {
        service = new RegistryReconcileService(floorsReconcileService, entranceReconcileService, entranceMatrixEnsureService);
    }

    @Test
    void shouldReconcileFloorsAndEnsureMatrix() {
        UUID blockId = UUID.randomUUID();
        var expected = new FloorsReconcileService.FloorsReconcileResult(1, 2);
        when(floorsReconcileService.reconcile(blockId)).thenReturn(expected);

        var result = service.reconcileFloors(blockId);

        assertEquals(expected, result);
        InOrder order = inOrder(floorsReconcileService, entranceMatrixEnsureService);
        order.verify(floorsReconcileService).reconcile(blockId);
        order.verify(entranceMatrixEnsureService).ensureForBlock(blockId);
    }

    @Test
    void shouldReconcileEntrancesAndEnsureMatrix() {
        UUID blockId = UUID.randomUUID();
        var expected = new EntranceReconcileService.EntranceReconcileResult(3, 1, 0);
        when(entranceReconcileService.reconcile(blockId, 3)).thenReturn(expected);

        var result = service.reconcileEntrances(blockId, 3);

        assertEquals(expected, result);
        InOrder order = inOrder(entranceReconcileService, entranceMatrixEnsureService);
        order.verify(entranceReconcileService).reconcile(blockId, 3);
        order.verify(entranceMatrixEnsureService).ensureForBlock(blockId);
    }
}