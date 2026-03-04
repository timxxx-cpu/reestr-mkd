package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import uz.reestrmkd.backend.entity.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.entity.BuildingBlockEntity;
import uz.reestrmkd.backend.entity.BuildingEntity;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class FloorGeneratorServiceTests {

    private final FloorGeneratorService service = new FloorGeneratorService();

    @Test
    void shouldGenerateVirtualIdsForUndergroundParkingFloors() {
        BuildingEntity building = new BuildingEntity();
        building.setCategory("parking_separate");
        building.setParkingType("underground");

        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(UUID.randomUUID());
        block.setType("Parking");
        block.setLevelsDepth(2);

        List<Map<String, Object>> floors = service.generateFloorsModel(block, building, List.of(block), List.of());

        assertEquals("level_minus_1", floors.get(0).get("id"));
        assertEquals("parking:-1", floors.get(0).get("floor_key"));
        assertEquals("level_minus_2", floors.get(1).get("id"));
        assertEquals("parking:-2", floors.get(1).get("floor_key"));
    }

    @Test
    void shouldGenerateVirtualIdsForRegularTechnicalAndTsokolFloors() {
        UUID blockId = UUID.randomUUID();

        BuildingEntity building = new BuildingEntity();
        building.setCategory("residential");

        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(blockId);
        block.setType("Ж");
        block.setFloorsFrom(1);
        block.setFloorsTo(1);
        block.setHasBasement(true);

        BlockFloorMarkerEntity technical = new BlockFloorMarkerEntity();
        technical.setMarkerKey("1-Т");
        technical.setIsTechnical(true);

        BlockFloorMarkerEntity extraTech = new BlockFloorMarkerEntity();
        extraTech.setMarkerType("technical");
        extraTech.setFloorIndex(3);

        List<Map<String, Object>> floors = service.generateFloorsModel(block, building, List.of(block), List.of(technical, extraTech));

        assertFloorKey(floors, "tsokol", "tsokol");
        assertFloorKey(floors, "floor_1", "floor:1");
        assertFloorKey(floors, "floor_1_tech", "tech:1");
        assertFloorKey(floors, "floor_3_tech_extra", "tech:3");
    }

    private static void assertFloorKey(List<Map<String, Object>> floors, String expectedId, String expectedFloorKey) {
        Map<String, Object> floor = floors.stream()
            .filter(item -> expectedId.equals(item.get("id")))
            .findFirst()
            .orElse(null);

        assertNotNull(floor);
        assertEquals(expectedFloorKey, floor.get("floor_key"));
    }
}
