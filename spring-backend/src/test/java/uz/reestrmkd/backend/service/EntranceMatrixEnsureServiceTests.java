package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixEnsureService;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class EntranceMatrixEnsureServiceTests {

    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private EntranceJpaRepository entranceJpaRepository;
    @Mock
    private EntranceMatrixJpaRepository entranceMatrixJpaRepository;

    private EntranceMatrixEnsureService service;

    @BeforeEach
    void setUp() {
        service = new EntranceMatrixEnsureService(floorJpaRepository, entranceJpaRepository, entranceMatrixJpaRepository);
    }

    @Test
    void shouldDeleteMatrixWhenNoFloorsOrEntrances() {
        UUID blockId = UUID.randomUUID();

        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of());
        when(entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId))
            .thenReturn(List.of(entrance(1)));

        service.ensureForBlock(blockId);

        verify(entranceMatrixJpaRepository).deleteByBlockId(blockId);
        verify(entranceMatrixJpaRepository, never()).findByBlockIdOrderByEntranceNumberAsc(blockId);
    }

    @Test
    void shouldDeleteStaleAndInsertMissingCells() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID staleFloorId = UUID.randomUUID();
        UUID staleId = UUID.randomUUID();

        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of(floor(floorId)));
        when(entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId))
            .thenReturn(List.of(entrance(1), entrance(2)));
        when(entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId))
            .thenReturn(List.of(
                matrix(staleId, blockId, staleFloorId, 1),
                matrix(UUID.randomUUID(), blockId, floorId, 1)
            ));

        service.ensureForBlock(blockId);

        verify(entranceMatrixJpaRepository).deleteAllByIdInBatch(List.of(staleId));

        ArgumentCaptor<List<EntranceMatrixEntity>> captor = listCaptor();
        verify(entranceMatrixJpaRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        EntranceMatrixEntity created = captor.getValue().getFirst();
        assertThat(created.getBlockId()).isEqualTo(blockId);
        assertThat(created.getFloorId()).isEqualTo(floorId);
        assertThat(created.getEntranceNumber()).isEqualTo(2);
    }

    private FloorEntity floor(UUID id) {
        FloorEntity entity = new FloorEntity();
        entity.setId(id);
        return entity;
    }

    private EntranceEntity entrance(int number) {
        EntranceEntity entity = new EntranceEntity();
        entity.setId(UUID.randomUUID());
        entity.setNumber(number);
        return entity;
    }

    private EntranceMatrixEntity matrix(UUID id, UUID blockId, UUID floorId, int entranceNumber) {
        EntranceMatrixEntity entity = new EntranceMatrixEntity();
        entity.setId(id);
        entity.setBlockId(blockId);
        entity.setFloorId(floorId);
        entity.setEntranceNumber(entranceNumber);
        return entity;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<List<EntranceMatrixEntity>> listCaptor() {
        return ArgumentCaptor.forClass((Class) List.class);
    }
}
