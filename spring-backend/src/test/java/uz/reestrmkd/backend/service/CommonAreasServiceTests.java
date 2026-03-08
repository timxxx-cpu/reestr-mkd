package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.CommonAreasService;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class CommonAreasServiceTests {

    @Mock
    private CommonAreaJpaRepository commonAreaJpaRepository;

    @Mock
    private FloorJpaRepository floorJpaRepository;

    @InjectMocks
    private CommonAreasService service;

    @Test
    void shouldInsertOnUpsertWhenNoId() {
        Map<String, Object> data = Map.of(
            "floorId", UUID.randomUUID().toString(),
            "entranceId", UUID.randomUUID().toString(),
            "type", "stairs",
            "area", "10.5",
            "height", "3.0"
        );

        service.upsert(data);

        verify(commonAreaJpaRepository).save(argThat(entity ->
            "stairs".equals(entity.getType())
                && entity.getFloorId() != null
                && entity.getEntranceId() != null
        ));
    }

    @Test
    void shouldFailWhenTypeMissing() {
        Map<String, Object> data = Map.of(
            "floorId", UUID.randomUUID().toString(),
            "entranceId", UUID.randomUUID().toString(),
            "area", "10.5",
            "height", "3.0"
        );

        assertThatThrownBy(() -> service.upsert(data))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("type is required");
    }

    @Test
    void shouldBatchUpsertAndReturnCount() {
        List<Map<String, Object>> items = List.of(
            Map.of("floorId", UUID.randomUUID().toString(), "entranceId", UUID.randomUUID().toString(), "type", "a", "area", "1", "height", "2"),
            Map.of("floorId", UUID.randomUUID().toString(), "entranceId", UUID.randomUUID().toString(), "type", "b", "area", "1", "height", "2")
        );

        int count = service.batchUpsert(items);

        assertThat(count).isEqualTo(2);
        verify(commonAreaJpaRepository, times(2)).save(any(CommonAreaEntity.class));
    }

    @Test
    void shouldListByBlockWhenNoFloorIds() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        FloorEntity floor = new FloorEntity();
        floor.setId(floorId);
        CommonAreaEntity commonArea = new CommonAreaEntity();
        commonArea.setId(UUID.randomUUID());
        commonArea.setFloorId(floorId);
        commonArea.setType("stairs");
        commonArea.setCreatedAt(Instant.now());

        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of(floor));
        when(commonAreaJpaRepository.findByFloorIdIn(List.of(floorId))).thenReturn(List.of(commonArea));

        List<Map<String, Object>> result = service.list(blockId, null);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst()).containsEntry("floor_id", floorId);
    }

    @Test
    void shouldUpdateExistingEntityWhenIdProvided() {
        UUID id = UUID.randomUUID();
        CommonAreaEntity existing = new CommonAreaEntity();
        existing.setId(id);
        existing.setCreatedAt(Instant.now());

        when(commonAreaJpaRepository.findById(id)).thenReturn(Optional.of(existing));

        service.upsert(Map.of(
            "id", id.toString(),
            "floorId", UUID.randomUUID().toString(),
            "type", "mop",
            "area", "1",
            "height", "2"
        ));

        verify(commonAreaJpaRepository).save(same(existing));
    }
}
