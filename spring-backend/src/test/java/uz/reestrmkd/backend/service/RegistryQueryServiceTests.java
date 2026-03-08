package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import uz.reestrmkd.backend.domain.registry.model.RegistryBuildingSummaryView;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.RegistryBuildingSummaryRepository;
import uz.reestrmkd.backend.domain.registry.service.RegistryQueryService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class RegistryQueryServiceTests {

    @Mock
    private RegistryBuildingSummaryRepository registryBuildingSummaryRepository;

    @Mock
    private FloorJpaRepository floorJpaRepository;

    @InjectMocks
    private RegistryQueryService registryQueryService;

    @Test
    void shouldLoadBuildingSummaryWithSearchFilterAndPagination() {
        RegistryBuildingSummaryView row = new RegistryBuildingSummaryView();
        row.setBuildingId(UUID.randomUUID());
        row.setProjectName("Test");
        row.setBuildingCode("UJ000001-ZM01");

        when(registryBuildingSummaryRepository.findSummary(eq("abc"), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(row)));

        List<Map<String, Object>> result = registryQueryService.loadBuildingsSummary("abc", 2, 20);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst()).containsEntry("project_name", "Test");

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(registryBuildingSummaryRepository).findSummary(eq("abc"), captor.capture());
        assertThat(captor.getValue().getPageNumber()).isEqualTo(1);
        assertThat(captor.getValue().getPageSize()).isEqualTo(20);
    }

    @Test
    void shouldUseSafeDefaultsForPagination() {
        when(registryBuildingSummaryRepository.findSummary(eq(null), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        registryQueryService.loadBuildingsSummary(null, 0, -5);

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(registryBuildingSummaryRepository).findSummary(eq(null), captor.capture());
        assertThat(captor.getValue().getPageNumber()).isZero();
        assertThat(captor.getValue().getPageSize()).isEqualTo(50);
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
