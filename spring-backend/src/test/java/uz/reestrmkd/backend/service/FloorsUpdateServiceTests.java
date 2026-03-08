package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.FloorsUpdateService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class FloorsUpdateServiceTests {

    @Mock
    private FloorJpaRepository floorJpaRepository;

    @InjectMocks
    private FloorsUpdateService service;

    @Test
    void shouldUpdateSingleFloorAndReturnRow() {
        UUID floorId = UUID.randomUUID();
        FloorEntity entity = new FloorEntity();
        entity.setId(floorId);
        when(floorJpaRepository.findById(floorId)).thenReturn(Optional.of(entity));
        when(floorJpaRepository.save(any(FloorEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> result = service.updateFloor(floorId, Map.of("label", "L"));

        assertThat(result).containsEntry("id", floorId);
        assertThat(result).containsEntry("label", "L");
    }

    @Test
    void shouldFailSingleUpdateWhenNoUpdates() {
        assertThatThrownBy(() -> service.updateFloor(UUID.randomUUID(), Map.of()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("updates are required");
    }

    @Test
    void shouldBatchUpdateWithFailedItems() {
        UUID floorId = UUID.randomUUID();
        List<Map<String, Object>> items = List.of(
            Map.of("id", floorId.toString(), "updates", Map.of("label", "X")),
            Map.of("id", UUID.randomUUID().toString(), "updates", Map.of("label", "Y")),
            Map.of("updates", Map.of("label", "Z"))
        );

        FloorEntity entity = new FloorEntity();
        entity.setId(floorId);
        when(floorJpaRepository.findAllById(anyIterable())).thenAnswer(invocation -> {
            List<UUID> ids = new ArrayList<>();
            invocation.<Iterable<UUID>>getArgument(0).forEach(ids::add);
            return ids.contains(floorId) ? List.of(entity) : List.of();
        });

        Map<String, Object> result = service.updateFloorsBatch(items, false);

        assertThat(result).containsEntry("updated", 1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> failed = (List<Map<String, Object>>) result.get("failed");
        assertThat(failed).hasSize(2);
        verify(floorJpaRepository).saveAll(argThat(iterable -> {
            List<FloorEntity> saved = StreamSupport.stream(iterable.spliterator(), false).toList();
            return saved.size() == 1 && floorId.equals(saved.getFirst().getId());
        }));
    }

    @Test
    void shouldFailSingleUpdateWhenFloorMissing() {
        UUID floorId = UUID.randomUUID();
        when(floorJpaRepository.findById(floorId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateFloor(floorId, Map.of("label", "L")))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Floor not found");
    }
}
