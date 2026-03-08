package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class EntranceMatrixServiceTests {

    @Mock
    private EntranceMatrixJpaRepository entranceMatrixJpaRepository;

    @InjectMocks
    private EntranceMatrixService service;

    @Test
    void shouldUpsertCellAndReturnRow() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        Map<String, Object> body = Map.of(
            "floorId", floorId,
            "entranceNumber", 1,
            "values", Map.of("flatsCount", 2)
        );
        when(entranceMatrixJpaRepository.findByBlockIdAndFloorIdAndEntranceNumber(blockId, floorId, 1))
            .thenReturn(Optional.empty());
        when(entranceMatrixJpaRepository.save(any(EntranceMatrixEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> result = service.upsertCell(blockId, body);

        assertThat(result).containsEntry("floor_id", floorId);
        assertThat(result).containsEntry("flats_count", 2);
        verify(entranceMatrixJpaRepository).save(argThat(entity ->
            blockId.equals(entity.getBlockId())
                && floorId.equals(entity.getFloorId())
                && Integer.valueOf(1).equals(entity.getEntranceNumber())
                && Integer.valueOf(2).equals(entity.getFlatsCount())
        ));
    }

    @Test
    void shouldFailWhenCellMissingRequiredFields() {
        UUID blockId = UUID.randomUUID();

        assertThatThrownBy(() -> service.upsertCell(blockId, Map.of()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("floorId and entranceNumber are required");
    }

    @Test
    void shouldUpsertBatchAndCollectFailures() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        List<Map<String, Object>> cells = List.of(
            Map.of("floorId", floorId, "entranceNumber", 1, "values", Map.of("flatsCount", 1)),
            Map.of("floorId", floorId, "values", Map.of("flatsCount", 1))
        );
        when(entranceMatrixJpaRepository.findByBlockIdAndFloorIdAndEntranceNumber(blockId, floorId, 1))
            .thenReturn(Optional.empty());

        Map<String, Object> result = service.upsertBatch(blockId, cells);

        assertThat(result).containsEntry("updated", 1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> failed = (List<Map<String, Object>>) result.get("failed");
        assertThat(failed).hasSize(1);
        verify(entranceMatrixJpaRepository, times(1)).saveAll(argThat(iterable -> {
            List<EntranceMatrixEntity> saved = StreamSupport.stream(iterable.spliterator(), false).toList();
            return saved.size() == 1
                && floorId.equals(saved.getFirst().getFloorId())
                && Integer.valueOf(1).equals(saved.getFirst().getEntranceNumber())
                && Integer.valueOf(1).equals(saved.getFirst().getFlatsCount());
        }));
    }
}
