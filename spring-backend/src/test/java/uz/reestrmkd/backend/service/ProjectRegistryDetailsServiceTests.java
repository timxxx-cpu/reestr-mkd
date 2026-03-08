package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.project.service.ProjectRegistryDetailsService;
import uz.reestrmkd.backend.domain.registry.model.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectRegistryDetailsServiceTests {

    @Mock
    private BuildingJpaRepository buildingJpaRepository;
    @Mock
    private BuildingBlockJpaRepository buildingBlockJpaRepository;
    @Mock
    private BlockFloorMarkerJpaRepository blockFloorMarkerJpaRepository;
    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private EntranceJpaRepository entranceJpaRepository;
    @Mock
    private EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;
    @Mock
    private CommonAreaJpaRepository commonAreaJpaRepository;

    @InjectMocks
    private ProjectRegistryDetailsService service;

    @Test
    void shouldBuildRegistryDetailsFromJpaRepositories() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();
        UUID unitId = UUID.randomUUID();
        UUID mopId = UUID.randomUUID();

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setProjectId(projectId);

        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(blockId);
        block.setBuildingId(buildingId);

        BlockFloorMarkerEntity marker = new BlockFloorMarkerEntity();
        marker.setBlockId(blockId);
        marker.setMarkerKey("P1");
        marker.setIsTechnical(true);
        marker.setIsCommercial(false);

        FloorEntity floor = new FloorEntity();
        floor.setId(floorId);
        floor.setBlockId(blockId);
        floor.setFloorKey("P1");
        floor.setLabel("-1");
        floor.setIndex(-1);
        floor.setFloorType("parking");

        EntranceEntity entrance = new EntranceEntity();
        entrance.setId(entranceId);
        entrance.setBlockId(blockId);
        entrance.setNumber(1);

        EntranceMatrixEntity matrix = new EntranceMatrixEntity();
        matrix.setBlockId(blockId);
        matrix.setFloorId(floorId);
        matrix.setEntranceNumber(1);
        matrix.setFlatsCount(2);
        matrix.setCommercialCount(1);
        matrix.setMopCount(3);

        UnitEntity unit = new UnitEntity();
        unit.setId(unitId);
        unit.setFloorId(floorId);
        unit.setEntranceId(entranceId);
        unit.setNumber("42-P");
        unit.setUnitType("parking_place");
        unit.setHasMezzanine(false);
        unit.setTotalArea(new BigDecimal("13.25"));
        unit.setRoomsCount(0);
        unit.setStatus("draft");
        unit.setCadastreNumber("12:34");

        CommonAreaEntity mop = new CommonAreaEntity();
        mop.setId(mopId);
        mop.setFloorId(floorId);
        mop.setEntranceId(entranceId);
        mop.setType("corridor");
        mop.setArea(new BigDecimal("8.5"));
        mop.setHeight(new BigDecimal("2.8"));

        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(building));
        when(buildingBlockJpaRepository.findByBuildingIdIn(List.of(buildingId))).thenReturn(List.of(block));
        when(blockFloorMarkerJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of(marker));
        when(floorJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of(floor));
        when(entranceJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of(entrance));
        when(entranceMatrixJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of(matrix));
        when(unitJpaRepository.findByFloorIdIn(List.of(floorId))).thenReturn(List.of(unit));
        when(commonAreaJpaRepository.findByFloorIdIn(List.of(floorId))).thenReturn(List.of(mop));

        Map<String, Object> response = service.getRegistryDetails(projectId);

        assertThat(response).containsKeys("markerRows", "floors", "entrances", "matrix", "units", "mops");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> markerRows = (List<Map<String, Object>>) response.get("markerRows");
        assertThat(markerRows.getFirst()).containsEntry("marker_key", "P1");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> units = (List<Map<String, Object>>) response.get("units");
        assertThat(units.getFirst()).containsEntry("number", "42-P");
        assertThat(units.getFirst()).containsEntry("cadastre_number", "12:34");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> mops = (List<Map<String, Object>>) response.get("mops");
        assertThat(mops.getFirst()).containsEntry("type", "corridor");
    }

    @Test
    void shouldReturnEmptyRegistryDetailsWhenProjectHasNoBlocks() {
        UUID projectId = UUID.randomUUID();
        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of());

        Map<String, Object> response = service.getRegistryDetails(projectId);

        assertThat(response).containsEntry("markerRows", List.of());
        assertThat(response).containsEntry("floors", List.of());
        assertThat(response).containsEntry("entrances", List.of());
        assertThat(response).containsEntry("matrix", List.of());
        assertThat(response).containsEntry("units", List.of());
        assertThat(response).containsEntry("mops", List.of());
    }
}
