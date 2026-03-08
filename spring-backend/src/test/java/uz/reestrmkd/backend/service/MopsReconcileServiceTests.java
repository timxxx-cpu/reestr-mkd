package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.MopsReconcileService;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class MopsReconcileServiceTests {

    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private EntranceJpaRepository entranceJpaRepository;
    @Mock
    private EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    @Mock
    private CommonAreaJpaRepository commonAreaJpaRepository;

    @InjectMocks
    private MopsReconcileService service;

    @Test
    void shouldReturnZeroWhenNoFloors() {
        UUID blockId = UUID.randomUUID();
        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of());

        MopsReconcileService.MopsReconcileResult result = service.reconcile(blockId);

        assertThat(result.removed()).isZero();
        assertThat(result.checkedCells()).isZero();
    }

    @Test
    void shouldDeleteMopsAboveDesiredCount() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();
        UUID keepId = UUID.randomUUID();
        UUID deleteId = UUID.randomUUID();

        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of(floor(floorId)));
        when(entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId)).thenReturn(List.of(entrance(entranceId, 1)));
        when(entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId))
            .thenReturn(List.of(matrix(floorId, 1, 1)));
        when(commonAreaJpaRepository.findByFloorIdIn(List.of(floorId)))
            .thenReturn(List.of(
                area(keepId, floorId, entranceId, Instant.parse("2024-01-01T00:00:00Z")),
                area(deleteId, floorId, entranceId, Instant.parse("2024-01-02T00:00:00Z"))
            ));

        MopsReconcileService.MopsReconcileResult result = service.reconcile(blockId);

        assertThat(result.checkedCells()).isEqualTo(1);
        assertThat(result.removed()).isEqualTo(1);
        verify(commonAreaJpaRepository).deleteAllByIdInBatch(List.of(deleteId));
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

    private EntranceMatrixEntity matrix(UUID floorId, int entranceNumber, int mopCount) {
        EntranceMatrixEntity entity = new EntranceMatrixEntity();
        entity.setFloorId(floorId);
        entity.setEntranceNumber(entranceNumber);
        entity.setMopCount(mopCount);
        return entity;
    }

    private CommonAreaEntity area(UUID id, UUID floorId, UUID entranceId, Instant createdAt) {
        CommonAreaEntity entity = new CommonAreaEntity();
        entity.setId(id);
        entity.setFloorId(floorId);
        entity.setEntranceId(entranceId);
        entity.setCreatedAt(createdAt);
        return entity;
    }
}
