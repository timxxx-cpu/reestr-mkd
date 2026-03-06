package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.RegistryBlockUnitsQueryService;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistryBlockUnitsQueryServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private FloorJpaRepository floorJpaRepository;

    @Mock
    private EntranceJpaRepository entranceJpaRepository;

    @InjectMocks
    private RegistryBlockUnitsQueryService service;

    @Test
    void shouldReturnUnitsAndEntranceMapForDefaultParams() {
        UUID blockId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();

        EntranceEntity entrance = new EntranceEntity();
        entrance.setId(entranceId);
        entrance.setNumber(2);

        when(jdbcTemplate.queryForList(contains("from units u"), any(Object[].class)))
            .thenReturn(List.of(Map.of("id", UUID.randomUUID(), "number", "1")));
        when(entranceJpaRepository.findByBlockIdInOrderByNumberAsc(eq(Set.of(blockId))))
            .thenReturn(List.of(entrance));

        Map<String, Object> result = service.loadUnits(blockId, null, null, null, null, null, null, null);

        assertThat(result).containsKeys("units", "entranceMap");
        assertThat((List<?>) result.get("units")).hasSize(1);
        @SuppressWarnings("unchecked")
        Map<String, Integer> entranceMap = (Map<String, Integer>) result.get("entranceMap");
        assertThat(entranceMap).containsEntry(entranceId.toString(), 2);

        verify(jdbcTemplate).queryForList(contains("limit ? offset ?"), any(Object[].class));
    }

    @Test
    void shouldApplySearchAndFilters() {
        UUID blockId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(contains("from units u"), any(Object[].class))).thenReturn(List.of());
        when(floorJpaRepository.findAllById(anyIterable())).thenReturn(List.of());
        when(entranceJpaRepository.findByBlockIdInOrderByNumberAsc(anyCollection())).thenReturn(List.of());

        String floorIds = UUID.randomUUID() + "," + UUID.randomUUID();
        Map<String, Object> result = service.loadUnits(blockId, floorIds, "12", "flat", "A", "1", 2, 50);

        assertThat(result).containsKeys("units", "entranceMap");
        verify(jdbcTemplate).queryForList(contains("u.unit_type=?"), any(Object[].class));
    }


    @Test
    void shouldIgnoreInvalidFloorIdsForJpaResolution() {
        UUID blockId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(contains("from units u"), any(Object[].class))).thenReturn(List.of());
        when(entranceJpaRepository.findByBlockIdInOrderByNumberAsc(anyCollection())).thenReturn(List.of());

        service.loadUnits(blockId, "bad-id,also-bad", null, null, null, null, null, null);

        verify(floorJpaRepository, never()).findAllById(anyIterable());
    }

    @Test
    void shouldResolveAdditionalEntranceBlocksByFloorIds() {
        UUID blockId = UUID.randomUUID();
        UUID relatedBlockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();

        FloorEntity floorEntity = new FloorEntity();
        floorEntity.setId(floorId);
        floorEntity.setBlockId(relatedBlockId);

        when(jdbcTemplate.queryForList(contains("from units u"), any(Object[].class))).thenReturn(List.of());
        when(floorJpaRepository.findAllById(eq(List.of(floorId)))).thenReturn(List.of(floorEntity));
        when(entranceJpaRepository.findByBlockIdInOrderByNumberAsc(argThat(ids -> ids.contains(blockId) && ids.contains(relatedBlockId))))
            .thenReturn(List.of());

        service.loadUnits(blockId, floorId.toString(), null, null, null, null, null, null);

        verify(entranceJpaRepository).findByBlockIdInOrderByNumberAsc(argThat(ids -> ids.contains(blockId) && ids.contains(relatedBlockId)));
    }
}
