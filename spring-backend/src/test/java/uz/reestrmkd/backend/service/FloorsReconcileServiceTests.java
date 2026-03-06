package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.FloorGeneratorService;
import uz.reestrmkd.backend.domain.registry.service.FloorsReconcileService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FloorsReconcileServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private BuildingBlockJpaRepository blockRepo;
    @Mock
    private BuildingJpaRepository buildingRepo;
    @Mock
    private BlockFloorMarkerJpaRepository markerRepo;
    @Mock
    private FloorGeneratorService floorGeneratorService;

    @InjectMocks
    private FloorsReconcileService service;

    @Test
    void shouldFailWhenBlockNotFound() {
        UUID blockId = UUID.randomUUID();
        when(blockRepo.findById(blockId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.reconcile(blockId))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Block not found");
    }

    @Test
    void shouldReconcileFloorsWithDeleteAndUpsert() {
        UUID blockId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID existingId = UUID.randomUUID();

        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(blockId);
        block.setBuildingId(buildingId);

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);

        when(blockRepo.findById(blockId)).thenReturn(Optional.of(block));
        when(buildingRepo.findById(buildingId)).thenReturn(Optional.of(building));
        when(blockRepo.findByBuildingId(buildingId)).thenReturn(List.of(block));
        when(markerRepo.findByBlockIdIn(List.of(blockId))).thenReturn(List.of());

        Map<String, Object> existingFloor = new java.util.HashMap<>();
        existingFloor.put("id", existingId);
        existingFloor.put("index", 1);
        existingFloor.put("parent_floor_index", null);
        existingFloor.put("basement_id", null);
        when(jdbcTemplate.queryForList(eq("select id, index, parent_floor_index, basement_id from floors where block_id=?"), eq(blockId)))
            .thenReturn(List.of(existingFloor));

        Map<String, Object> generatedFloor = new java.util.HashMap<>();
        generatedFloor.put("block_id", blockId);
        generatedFloor.put("index", 2);
        generatedFloor.put("floor_key", "F2");
        generatedFloor.put("label", "2");
        generatedFloor.put("floor_type", "residential");
        generatedFloor.put("height", null);
        generatedFloor.put("area_proj", null);
        generatedFloor.put("is_technical", false);
        generatedFloor.put("is_commercial", false);
        generatedFloor.put("is_stylobate", false);
        generatedFloor.put("is_basement", false);
        generatedFloor.put("is_attic", false);
        generatedFloor.put("is_loft", false);
        generatedFloor.put("is_roof", false);
        generatedFloor.put("parent_floor_index", null);
        generatedFloor.put("basement_id", null);

        when(floorGeneratorService.generateFloorsModel(eq(block), eq(building), anyList(), anyList()))
            .thenReturn(List.of(generatedFloor));

        when(jdbcTemplate.queryForList(contains("select id, index from floors where id in"), any(Object[].class)))
            .thenReturn(List.of(Map.of("id", existingId, "index", 1)));

        FloorsReconcileService.FloorsReconcileResult result = service.reconcile(blockId);

        assertThat(result.deleted()).isEqualTo(1);
        assertThat(result.upserted()).isEqualTo(1);
    }
}
