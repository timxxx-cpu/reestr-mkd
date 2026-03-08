package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.UnitsReconcileService;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class UnitsReconcileServiceTests {

    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private EntranceJpaRepository entranceJpaRepository;
    @Mock
    private EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;

    @InjectMocks
    private UnitsReconcileService service;

    @Test
    void shouldReturnZeroWhenNoFloors() {
        UUID blockId = UUID.randomUUID();
        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of());

        UnitsReconcileService.UnitsReconcileResult result = service.reconcile(blockId);

        assertThat(result.removed()).isZero();
        assertThat(result.added()).isZero();
        assertThat(result.checkedCells()).isZero();
    }

    @Test
    void shouldAddAndDeleteUnitsByMatrixTargets() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();
        UUID toDelete = UUID.randomUUID();

        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of(floor(floorId)));
        when(entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId)).thenReturn(List.of(entrance(entranceId, 1)));
        when(entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId))
            .thenReturn(List.of(matrix(floorId, 1, 2, 0)));
        when(unitJpaRepository.findByFloorIdIn(List.of(floorId)))
            .thenReturn(List.of(existingCommercial(toDelete, floorId, entranceId)));

        UnitsReconcileService.UnitsReconcileResult result = service.reconcile(blockId);

        assertThat(result.added()).isEqualTo(2);
        assertThat(result.removed()).isEqualTo(1);
        assertThat(result.checkedCells()).isEqualTo(1);

        verify(unitJpaRepository).deleteAllByIdInBatch(List.of(toDelete));

        ArgumentCaptor<List<UnitEntity>> captor = listCaptor();
        verify(unitJpaRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(2);
        assertThat(captor.getValue()).allSatisfy(unit -> {
            assertThat(unit.getFloorId()).isEqualTo(floorId);
            assertThat(unit.getEntranceId()).isEqualTo(entranceId);
            assertThat(unit.getUnitType()).isEqualTo("flat");
            assertThat(unit.getStatus()).isEqualTo("free");
            assertThat(unit.getHasMezzanine()).isFalse();
        });
    }

    private FloorEntity floor(UUID id) {
        FloorEntity entity = new FloorEntity();
        entity.setId(id);
        return entity;
    }

    private EntranceEntity entrance(UUID id, int number) {
        EntranceEntity entity = new EntranceEntity();
        entity.setId(id);
        entity.setNumber(number);
        return entity;
    }

    private EntranceMatrixEntity matrix(UUID floorId, int entranceNumber, int flatsCount, int commercialCount) {
        EntranceMatrixEntity entity = new EntranceMatrixEntity();
        entity.setFloorId(floorId);
        entity.setEntranceNumber(entranceNumber);
        entity.setFlatsCount(flatsCount);
        entity.setCommercialCount(commercialCount);
        return entity;
    }

    private UnitEntity existingCommercial(UUID id, UUID floorId, UUID entranceId) {
        UnitEntity entity = new UnitEntity();
        entity.setId(id);
        entity.setFloorId(floorId);
        entity.setEntranceId(entranceId);
        entity.setUnitType("office");
        entity.setCreatedAt(Instant.now());
        return entity;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<List<UnitEntity>> listCaptor() {
        return ArgumentCaptor.forClass((Class) List.class);
    }
}
