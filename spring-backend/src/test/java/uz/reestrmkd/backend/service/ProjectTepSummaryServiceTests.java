package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.project.service.ProjectTepSummaryService;
import uz.reestrmkd.backend.domain.registry.api.TepSummaryResponseDto;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectTepSummaryServiceTests {

    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;
    @Mock
    private CommonAreaJpaRepository commonAreaJpaRepository;
    @Mock
    private BuildingJpaRepository buildingJpaRepository;

    @Test
    void shouldBuildTepSummaryFromJpaProjections() {
        ProjectTepSummaryService service = new ProjectTepSummaryService(
            floorJpaRepository,
            unitJpaRepository,
            commonAreaJpaRepository,
            buildingJpaRepository
        );
        UUID projectId = UUID.randomUUID();

        when(floorJpaRepository.sumAreaProjByProjectId(projectId)).thenReturn(new BigDecimal("500.12"));
        when(floorJpaRepository.sumAreaFactByProjectId(projectId)).thenReturn(new BigDecimal("450.34"));
        when(commonAreaJpaRepository.sumAreaByProjectId(projectId)).thenReturn(new BigDecimal("42.10"));
        when(unitJpaRepository.findTepUnitRowsByProjectId(projectId)).thenReturn(List.of(
            unit("flat", "100.50", "cad-1"),
            unit("office", "25.25", null),
            unit("parking_place", "10.00", "cad-2"),
            unit("storeroom", "5.75", "")
        ));
        when(buildingJpaRepository.findTimelineRowsByProjectId(projectId)).thenReturn(List.of(
            timeline(LocalDate.now().minusDays(30), null),
            timeline(LocalDate.now().minusDays(365), LocalDate.now().minusDays(1))
        ));

        TepSummaryResponseDto response = service.getTepSummary(projectId);

        assertThat(response.totalAreaProj()).isEqualByComparingTo("500.12");
        assertThat(response.totalAreaFact()).isEqualByComparingTo("450.34");
        assertThat(response.living().area()).isEqualByComparingTo("100.50");
        assertThat(response.living().count()).isEqualTo(1);
        assertThat(response.commercial().area()).isEqualByComparingTo("25.25");
        assertThat(response.commercial().count()).isEqualTo(1);
        assertThat(response.infrastructure().area()).isEqualByComparingTo("5.75");
        assertThat(response.infrastructure().count()).isEqualTo(1);
        assertThat(response.parking().area()).isEqualByComparingTo("10.00");
        assertThat(response.parking().count()).isEqualTo(1);
        assertThat(response.mop().area()).isEqualByComparingTo("42.10");
        assertThat(response.cadastreReadyCount()).isEqualTo(2);
        assertThat(response.totalObjectsCount()).isEqualTo(4);
        assertThat(response.avgProgress()).isGreaterThan(BigDecimal.ZERO);
    }

    private UnitJpaRepository.TepUnitRow unit(String unitType, String totalArea, String cadastreNumber) {
        return new UnitJpaRepository.TepUnitRow() {
            @Override
            public String getUnitType() {
                return unitType;
            }

            @Override
            public BigDecimal getTotalArea() {
                return new BigDecimal(totalArea);
            }

            @Override
            public String getCadastreNumber() {
                return cadastreNumber;
            }
        };
    }

    private BuildingJpaRepository.BuildingTimelineRow timeline(LocalDate dateStart, LocalDate dateEnd) {
        return new BuildingJpaRepository.BuildingTimelineRow() {
            @Override
            public LocalDate getDateStart() {
                return dateStart;
            }

            @Override
            public LocalDate getDateEnd() {
                return dateEnd;
            }
        };
    }
}
