package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.project.service.ProjectFullRegistryService;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.RoomEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.RoomJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectFullRegistryServiceTests {

    @Mock
    private BuildingJpaRepository buildingRepo;
    @Mock
    private BuildingBlockJpaRepository blockRepo;
    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private EntranceJpaRepository entranceJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;
    @Mock
    private RoomJpaRepository roomJpaRepository;

    @InjectMocks
    private ProjectFullRegistryService service;

    @Test
    void shouldBuildFullRegistryFromJpaRepositories() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();
        UUID unitId = UUID.randomUUID();
        UUID roomId = UUID.randomUUID();

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setProjectId(projectId);
        building.setBuildingCode("UJ000001-ZR01");
        building.setLabel("Building A");
        building.setHouseNumber("10");
        building.setCategory("residential");

        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(blockId);
        block.setBuildingId(buildingId);
        block.setLabel("Block 1");
        block.setType("Ж");
        block.setFloorsCount(9);

        FloorEntity floor = new FloorEntity();
        floor.setId(floorId);
        floor.setBlockId(blockId);
        floor.setIndex(2);
        floor.setLabel("2");
        floor.setFloorType("residential");

        EntranceEntity entrance = new EntranceEntity();
        entrance.setId(entranceId);
        entrance.setBlockId(blockId);
        entrance.setNumber(1);

        UnitEntity unit = new UnitEntity();
        unit.setId(unitId);
        unit.setFloorId(floorId);
        unit.setEntranceId(entranceId);
        unit.setUnitCode("U-1");
        unit.setUnitType("flat");
        unit.setNumber("1");
        unit.setRoomsCount(2);

        RoomEntity room = new RoomEntity();
        room.setId(roomId);
        room.setUnit(unit);
        room.setRoomType("living");
        room.setLevel(1);

        when(buildingRepo.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(building));
        when(blockRepo.findByBuildingIdIn(List.of(buildingId))).thenReturn(List.of(block));
        when(floorJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of(floor));
        when(entranceJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of(entrance));
        when(unitJpaRepository.findByFloorIdIn(List.of(floorId))).thenReturn(List.of(unit));
        when(roomJpaRepository.findByUnit_IdIn(List.of(unitId))).thenReturn(List.of(room));

        Map<String, Object> response = service.getFullRegistry(projectId);

        assertThat(response).containsKeys("buildings", "blocks", "floors", "entrances", "units");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> units = (List<Map<String, Object>>) response.get("units");
        assertThat(units).hasSize(1);
        assertThat(units.getFirst()).containsEntry("buildingId", buildingId);
        assertThat(units.getFirst()).containsEntry("buildingCode", "UJ000001-ZR01");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> explication = (List<Map<String, Object>>) units.getFirst().get("explication");
        assertThat(explication).hasSize(1);
        assertThat(explication.getFirst()).containsEntry("type", "living");
    }
}
