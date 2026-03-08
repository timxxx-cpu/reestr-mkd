package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.project.service.ProjectMapOverviewService;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectMapOverviewServiceTests {

    @Mock
    private ProjectJpaRepository projectJpaRepository;
    @Mock
    private ApplicationJpaRepository applicationJpaRepository;
    @Mock
    private BuildingJpaRepository buildingJpaRepository;
    @Mock
    private BuildingBlockJpaRepository buildingBlockJpaRepository;
    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;

    @Test
    void shouldBuildMapOverviewFromJpaQueries() {
        ProjectMapOverviewService service = new ProjectMapOverviewService(
            projectJpaRepository,
            applicationJpaRepository,
            buildingJpaRepository,
            buildingBlockJpaRepository,
            floorJpaRepository,
            unitJpaRepository
        );
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID mainBlockId = UUID.randomUUID();
        UUID basementBlockId = UUID.randomUUID();
        UUID floorOneId = UUID.randomUUID();
        UUID floorTwoId = UUID.randomUUID();

        when(projectJpaRepository.findByScopeIdOrderByUpdatedAtDesc("scope-1"))
            .thenReturn(List.of(project(projectId)));
        when(applicationJpaRepository.findByScopeIdOrderByUpdatedAtDesc("scope-1"))
            .thenReturn(List.of(application(projectId, "IN_PROGRESS")));
        when(buildingJpaRepository.findByProjectIdIn(List.of(projectId)))
            .thenReturn(List.of(building(projectId, buildingId)));
        when(buildingBlockJpaRepository.findByBuildingIdIn(List.of(buildingId)))
            .thenReturn(List.of(
                block(buildingId, mainBlockId, "A", "residential", 9, false),
                block(buildingId, basementBlockId, "B1", "parking", 2, true)
            ));
        when(floorJpaRepository.findByBlockIdIn(List.of(mainBlockId, basementBlockId)))
            .thenReturn(List.of(floor(mainBlockId, floorOneId), floor(basementBlockId, floorTwoId)));
        when(unitJpaRepository.findByFloorIdIn(List.of(floorOneId, floorTwoId)))
            .thenReturn(List.of(
                unit(floorOneId, "apartment"),
                unit(floorOneId, "office"),
                unit(floorTwoId, "parking_place")
            ));

        Map<String, Object> response = service.mapOverview("scope-1");

        verify(projectJpaRepository).findByScopeIdOrderByUpdatedAtDesc("scope-1");
        verify(applicationJpaRepository).findByScopeIdOrderByUpdatedAtDesc("scope-1");
        assertThat(response).containsKey("items");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("items");
        assertThat(items).hasSize(1);

        Map<String, Object> item = items.getFirst();
        assertThat(item).containsEntry("id", projectId);
        assertThat(item).containsEntry("ujCode", "UJ000777");
        assertThat(item).containsEntry("status", "IN_PROGRESS");
        assertThat(item).containsEntry("totalBuildings", 1);
        assertThat(item).containsEntry("landPlotGeometry", Map.of("type", "Polygon"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> buildingTypeStats = (List<Map<String, Object>>) item.get("buildingTypeStats");
        assertThat(buildingTypeStats).containsExactly(Map.of("category", "residential", "count", 1L));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> buildings = (List<Map<String, Object>>) item.get("buildings");
        assertThat(buildings).hasSize(1);

        Map<String, Object> building = buildings.getFirst();
        assertThat(building).containsEntry("id", buildingId);
        assertThat(building).containsEntry("blocksCount", 1);
        assertThat(building).containsEntry("floorsMax", 9);
        assertThat(building).containsEntry("unitsCount", 3);
        assertThat(building).containsEntry("apartmentsCount", 1L);
        assertThat(String.valueOf(building.get("address"))).endsWith("42");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> blocks = (List<Map<String, Object>>) building.get("blocks");
        assertThat(blocks).hasSize(1);
        assertThat(blocks.getFirst()).containsEntry("id", mainBlockId);
    }

    @Test
    void shouldRequireScope() {
        ProjectMapOverviewService service = new ProjectMapOverviewService(
            projectJpaRepository,
            applicationJpaRepository,
            buildingJpaRepository,
            buildingBlockJpaRepository,
            floorJpaRepository,
            unitJpaRepository
        );

        assertThatThrownBy(() -> service.mapOverview(" "))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Scope is required");
    }

    private ProjectEntity project(UUID projectId) {
        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setUjCode("UJ000777");
        project.setName("Project A");
        project.setAddress("Street 1");
        project.setConstructionStatus("PLANNED");
        project.setLandPlotGeojson(Map.of("type", "Polygon"));
        return project;
    }

    private ApplicationEntity application(UUID projectId, String status) {
        ApplicationEntity application = new ApplicationEntity();
        application.setId(UUID.randomUUID());
        application.setProjectId(projectId);
        application.setStatus(status);
        return application;
    }

    private BuildingEntity building(UUID projectId, UUID buildingId) {
        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setProjectId(projectId);
        building.setLabel("Building A");
        building.setBuildingCode("B-01");
        building.setHouseNumber("42");
        building.setCategory("residential");
        building.setFootprintGeojson(Map.of("type", "Polygon"));
        return building;
    }

    private BuildingBlockEntity block(UUID buildingId, UUID blockId, String label, String type, Integer floorsCount, boolean basement) {
        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(blockId);
        block.setBuildingId(buildingId);
        block.setLabel(label);
        block.setType(type);
        block.setFloorsCount(floorsCount);
        block.setIsBasementBlock(basement);
        block.setFootprintGeojson(Map.of("type", "Polygon"));
        return block;
    }

    private FloorEntity floor(UUID blockId, UUID floorId) {
        FloorEntity floor = new FloorEntity();
        floor.setId(floorId);
        floor.setBlockId(blockId);
        return floor;
    }

    private UnitEntity unit(UUID floorId, String unitType) {
        UnitEntity unit = new UnitEntity();
        unit.setId(UUID.randomUUID());
        unit.setFloorId(floorId);
        unit.setUnitType(unitType);
        return unit;
    }
}
