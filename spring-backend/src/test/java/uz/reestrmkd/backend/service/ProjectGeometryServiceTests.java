package uz.reestrmkd.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectGeometryCandidateEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectGeometryCandidateJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.project.service.ProjectGeometryService;
import uz.reestrmkd.backend.domain.registry.api.GeometryCandidateImportItemDto;
import uz.reestrmkd.backend.domain.registry.api.GeometryCandidateResponseDto;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectGeometryServiceTests {

    @Mock
    private ProjectGeometryCandidateJpaRepository projectGeometryCandidateJpaRepository;
    @Mock
    private ProjectJpaRepository projectJpaRepository;
    @Mock
    private BuildingJpaRepository buildingJpaRepository;

    private ProjectGeometryService service;

    @BeforeEach
    void setUp() {
        service = new ProjectGeometryService(
            projectGeometryCandidateJpaRepository,
            projectJpaRepository,
            buildingJpaRepository,
            new ObjectMapper()
        );
    }

    @Test
    void shouldReadCandidatesFromJpaRepository() {
        UUID projectId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();
        ProjectGeometryCandidateEntity candidate = new ProjectGeometryCandidateEntity();
        candidate.setId(candidateId);
        candidate.setProjectId(projectId);
        candidate.setSourceIndex(2);
        candidate.setLabel("Land 1");
        candidate.setAreaM2(new BigDecimal("123.45"));

        when(projectGeometryCandidateJpaRepository.findByProjectIdOrderBySourceIndexAscIdAsc(projectId)).thenReturn(List.of(candidate));

        List<GeometryCandidateResponseDto> response = service.getCandidates(projectId);

        assertThat(response).hasSize(1);
        assertThat(response.getFirst().id()).isEqualTo(candidateId);
        assertThat(response.getFirst().label()).isEqualTo("Land 1");
    }

    @Test
    void shouldImportOnlyCandidatesWithGeometry() {
        UUID projectId = UUID.randomUUID();
        ObjectMapper mapper = new ObjectMapper();
        GeometryCandidateImportItemDto candidate = new GeometryCandidateImportItemDto(
            null,
            "Lot 1",
            mapper.valueToTree(Map.of("cadastre", "12:34")),
            mapper.valueToTree(Map.of("type", "Polygon"))
        );
        GeometryCandidateImportItemDto skipped = new GeometryCandidateImportItemDto(2, "Empty", null, null);

        when(projectGeometryCandidateJpaRepository.upsertGeometryCandidate(
            eq(projectId),
            eq(100),
            eq("Lot 1"),
            anyString(),
            eq("{\"type\":\"Polygon\"}")
        )).thenReturn(true);

        int imported = service.importCandidates(projectId, List.of(candidate, skipped));

        assertThat(imported).isEqualTo(1);
        verify(projectGeometryCandidateJpaRepository).upsertGeometryCandidate(
            eq(projectId),
            eq(100),
            eq("Lot 1"),
            anyString(),
            eq("{\"type\":\"Polygon\"}")
        );
    }

    @Test
    void shouldSelectLandViaJpaAndUpdateSpatialColumnViaJdbc() {
        UUID projectId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();

        ProjectGeometryCandidateEntity selected = new ProjectGeometryCandidateEntity();
        selected.setId(candidateId);
        selected.setProjectId(projectId);
        selected.setGeometry(new ObjectMapper().valueToTree(Map.of("type", "Polygon")));
        selected.setAreaM2(new BigDecimal("150.0"));
        selected.setIsSelectedLandPlot(false);

        ProjectGeometryCandidateEntity other = new ProjectGeometryCandidateEntity();
        other.setId(UUID.randomUUID());
        other.setProjectId(projectId);
        other.setIsSelectedLandPlot(true);

        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);

        when(projectGeometryCandidateJpaRepository.findByIdAndProjectId(candidateId, projectId)).thenReturn(Optional.of(selected));
        when(projectGeometryCandidateJpaRepository.findByProjectId(projectId)).thenReturn(List.of(selected, other));
        when(projectJpaRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectJpaRepository.updateLandPlotGeom(eq(projectId), anyString())).thenReturn(1);

        service.selectLand(projectId, candidateId);

        assertThat(selected.getIsSelectedLandPlot()).isTrue();
        assertThat(other.getIsSelectedLandPlot()).isFalse();
        verify(projectGeometryCandidateJpaRepository).saveAll(List.of(selected, other));

        ArgumentCaptor<ProjectEntity> projectCaptor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projectJpaRepository).save(projectCaptor.capture());
        assertThat(projectCaptor.getValue().getLandPlotAreaM2()).isEqualByComparingTo("150.0");
        assertThat(projectCaptor.getValue().getLandPlotGeojson()).containsEntry("type", "Polygon");
        verify(projectJpaRepository).updateLandPlotGeom(eq(projectId), anyString());
    }

    @Test
    void shouldDeleteCandidateAndClearLinkedGeometryState() {
        UUID projectId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();

        ProjectGeometryCandidateEntity candidate = new ProjectGeometryCandidateEntity();
        candidate.setId(candidateId);
        candidate.setProjectId(projectId);
        candidate.setAssignedBuildingId(buildingId);
        candidate.setIsSelectedLandPlot(true);

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setProjectId(projectId);
        building.setGeometryCandidateId(candidateId);
        building.setBuildingFootprintAreaM2(new BigDecimal("99"));

        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setLandPlotAreaM2(new BigDecimal("100"));

        when(projectGeometryCandidateJpaRepository.findByIdAndProjectId(candidateId, projectId)).thenReturn(Optional.of(candidate));
        when(buildingJpaRepository.findById(buildingId)).thenReturn(Optional.of(building));
        when(projectJpaRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(buildingJpaRepository.clearBuildingFootprintGeom(buildingId, projectId)).thenReturn(1);
        when(projectJpaRepository.clearLandPlotGeom(projectId)).thenReturn(1);

        service.deleteCandidate(projectId, candidateId);

        verify(buildingJpaRepository).save(building);
        assertThat(building.getGeometryCandidateId()).isNull();
        assertThat(building.getFootprintGeojson()).isNull();
        verify(projectJpaRepository).save(project);
        assertThat(project.getLandPlotGeojson()).isNull();
        assertThat(project.getLandPlotAreaM2()).isNull();
        verify(buildingJpaRepository).clearBuildingFootprintGeom(buildingId, projectId);
        verify(projectJpaRepository).clearLandPlotGeom(projectId);
        verify(projectGeometryCandidateJpaRepository).delete(candidate);
    }

    @Test
    void shouldSelectBuildingGeometryViaJpaAndUpdateSpatialColumnViaJdbc() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();

        ProjectGeometryCandidateEntity selected = new ProjectGeometryCandidateEntity();
        selected.setId(candidateId);
        selected.setProjectId(projectId);
        selected.setGeometry(new ObjectMapper().valueToTree(Map.of("type", "Polygon")));
        selected.setAreaM2(new BigDecimal("75.5"));

        ProjectGeometryCandidateEntity other = new ProjectGeometryCandidateEntity();
        other.setId(UUID.randomUUID());
        other.setProjectId(projectId);
        other.setAssignedBuildingId(buildingId);

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setProjectId(projectId);

        when(buildingJpaRepository.findById(buildingId)).thenReturn(Optional.of(building));
        when(projectGeometryCandidateJpaRepository.findByIdAndProjectId(candidateId, projectId)).thenReturn(Optional.of(selected));
        when(projectJpaRepository.hasLandPlotGeom(projectId)).thenReturn(true);
        when(projectJpaRepository.isGeometryCoveredByLandPlot(projectId, "{\"type\":\"Polygon\"}")).thenReturn(true);
        when(buildingJpaRepository.intersectsExistingBuildingGeometry(projectId, buildingId, "{\"type\":\"Polygon\"}")).thenReturn(false);
        when(buildingJpaRepository.updateBuildingFootprintGeom(buildingId, projectId, "{\"type\":\"Polygon\"}")).thenReturn(1);
        when(projectGeometryCandidateJpaRepository.findByProjectId(projectId)).thenReturn(List.of(selected, other));

        service.selectBuildingGeometry(projectId, buildingId, candidateId);

        verify(buildingJpaRepository).save(building);
        assertThat(building.getGeometryCandidateId()).isEqualTo(candidateId);
        assertThat(building.getFootprintGeojson()).containsEntry("type", "Polygon");
        assertThat(building.getBuildingFootprintAreaM2()).isEqualByComparingTo("75.5");
        assertThat(selected.getAssignedBuildingId()).isEqualTo(buildingId);
        assertThat(other.getAssignedBuildingId()).isNull();
        verify(projectGeometryCandidateJpaRepository).saveAll(List.of(selected, other));
        verify(buildingJpaRepository).updateBuildingFootprintGeom(buildingId, projectId, "{\"type\":\"Polygon\"}");
    }

    @Test
    void shouldClearBuildingGeometryAssignmentWhenCandidateIsNull() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();

        ProjectGeometryCandidateEntity assigned = new ProjectGeometryCandidateEntity();
        assigned.setId(UUID.randomUUID());
        assigned.setProjectId(projectId);
        assigned.setAssignedBuildingId(buildingId);

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setProjectId(projectId);
        building.setGeometryCandidateId(UUID.randomUUID());
        building.setBuildingFootprintAreaM2(new BigDecimal("10"));

        when(buildingJpaRepository.findById(buildingId)).thenReturn(Optional.of(building));
        when(projectGeometryCandidateJpaRepository.findByProjectId(projectId)).thenReturn(List.of(assigned));
        when(buildingJpaRepository.clearBuildingFootprintGeom(buildingId, projectId)).thenReturn(1);

        service.selectBuildingGeometry(projectId, buildingId, null);

        verify(buildingJpaRepository).save(building);
        assertThat(building.getGeometryCandidateId()).isNull();
        assertThat(building.getFootprintGeojson()).isNull();
        assertThat(building.getBuildingFootprintAreaM2()).isNull();
        assertThat(assigned.getAssignedBuildingId()).isNull();
        verify(projectGeometryCandidateJpaRepository).saveAll(List.of(assigned));
        verify(buildingJpaRepository).clearBuildingFootprintGeom(buildingId, projectId);
    }
}
