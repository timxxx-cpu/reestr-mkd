package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.RegistryQueryService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class RegistryQueryServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private FloorJpaRepository floorJpaRepository;

    @InjectMocks
    private RegistryQueryService registryQueryService;

    @Test
    void shouldLoadBuildingSummaryWithSearchFilterAndPagination() {
        when(jdbcTemplate.queryForList(contains("ilike"), any(Object[].class)))
            .thenReturn(List.of(Map.of("project_name", "Test")));

        List<Map<String, Object>> result = registryQueryService.loadBuildingsSummary("abc", 2, 20);

        assertThat(result).hasSize(1);
        verify(jdbcTemplate).queryForList(contains("order by project_name asc limit ? offset ?"), any(Object[].class));
    }

    @Test
    void shouldUseSafeDefaultsForPagination() {
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
            .thenReturn(List.of());

        registryQueryService.loadBuildingsSummary(null, 0, -5);

        verify(jdbcTemplate).queryForList(contains("limit ? offset ?"), any(Object[].class));
    }

    @Test
    void shouldMapParkingCountsByFloorId() {
        UUID projectId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();

        FloorJpaRepository.FloorParkingCountRow row = new FloorJpaRepository.FloorParkingCountRow() {
            @Override
            public UUID getFloorId() {
                return floorId;
            }

            @Override
            public Long getParkingCount() {
                return 5L;
            }
        };

        when(floorJpaRepository.countParkingPlacesByProjectId(projectId)).thenReturn(List.of(row));

        Map<String, Integer> result = registryQueryService.loadParkingCounts(projectId);

        assertThat(result).containsEntry(floorId.toString(), 5);
    }
}