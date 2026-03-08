package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.EntranceReconcileService;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class EntranceReconcileServiceTests {

    @Mock
    private EntranceJpaRepository entranceJpaRepository;

    @InjectMocks
    private EntranceReconcileService service;

    @Test
    void shouldCreateMissingEntrances() {
        UUID blockId = UUID.randomUUID();
        when(entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId))
            .thenReturn(List.of(entrance(UUID.randomUUID(), blockId, 1)));

        EntranceReconcileService.EntranceReconcileResult result = service.reconcile(blockId, 3);

        assertThat(result.count()).isEqualTo(3);
        assertThat(result.created()).isEqualTo(2);
        assertThat(result.deleted()).isZero();

        ArgumentCaptor<List<EntranceEntity>> captor = listCaptor();
        verify(entranceJpaRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).extracting(EntranceEntity::getNumber).containsExactly(2, 3);
    }

    @Test
    void shouldDeleteEntrancesAboveCount() {
        UUID blockId = UUID.randomUUID();
        UUID e1 = UUID.randomUUID();
        UUID e2 = UUID.randomUUID();
        UUID e3 = UUID.randomUUID();

        when(entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId))
            .thenReturn(List.of(
                entrance(e1, blockId, 1),
                entrance(e2, blockId, 2),
                entrance(e3, blockId, 3)
            ));

        EntranceReconcileService.EntranceReconcileResult result = service.reconcile(blockId, 1);

        assertThat(result.count()).isEqualTo(1);
        assertThat(result.created()).isZero();
        assertThat(result.deleted()).isEqualTo(2);
        verify(entranceJpaRepository).deleteAllByIdInBatch(List.of(e2, e3));
    }

    private EntranceEntity entrance(UUID id, UUID blockId, int number) {
        EntranceEntity entity = new EntranceEntity();
        entity.setId(id);
        entity.setBlockId(blockId);
        entity.setNumber(number);
        return entity;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<List<EntranceEntity>> listCaptor() {
        return ArgumentCaptor.forClass((Class) List.class);
    }
}
