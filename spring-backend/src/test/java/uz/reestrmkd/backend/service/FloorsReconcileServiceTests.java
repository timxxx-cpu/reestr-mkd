package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.FloorGeneratorService;
import uz.reestrmkd.backend.domain.registry.service.FloorsReconcileService;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FloorsReconcileServiceTests {

    @Mock
    private BuildingBlockJpaRepository blockRepo;
    @Mock
    private BuildingJpaRepository buildingRepo;
    @Mock
    private BlockFloorMarkerJpaRepository markerRepo;
    @Mock
    private FloorJpaRepository floorRepo;
    @Mock
    private UnitJpaRepository unitRepo;
    @Mock
    private CommonAreaJpaRepository commonAreaRepo;
    @Mock
    private EntranceMatrixJpaRepository entranceMatrixRepo;
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
        UUID reusedId = UUID.randomUUID();

        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(blockId);
        block.setBuildingId(buildingId);

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);

        FloorEntity staleFloor = new FloorEntity();
        staleFloor.setId(existingId);
        staleFloor.setBlockId(blockId);
        staleFloor.setIndex(1);
        staleFloor.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));

        FloorEntity reusedFloor = new FloorEntity();
        reusedFloor.setId(reusedId);
        reusedFloor.setBlockId(blockId);
        reusedFloor.setIndex(2);
        reusedFloor.setCreatedAt(Instant.parse("2026-01-02T00:00:00Z"));

        when(blockRepo.findById(blockId)).thenReturn(Optional.of(block));
        when(buildingRepo.findById(buildingId)).thenReturn(Optional.of(building));
        when(blockRepo.findByBuildingId(buildingId)).thenReturn(List.of(block));
        when(markerRepo.findByBlockIdIn(List.of(blockId))).thenReturn(List.of());
        when(floorRepo.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of(staleFloor, reusedFloor));

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
        when(floorRepo.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        FloorsReconcileService.FloorsReconcileResult result = service.reconcile(blockId);

        assertThat(result.deleted()).isEqualTo(1);
        assertThat(result.upserted()).isEqualTo(1);

        ArgumentCaptor<List<FloorEntity>> floorsCaptor = floorListCaptor();
        verify(floorRepo).saveAll(floorsCaptor.capture());
        assertThat(floorsCaptor.getValue()).hasSize(1);
        FloorEntity savedFloor = floorsCaptor.getValue().getFirst();
        assertThat(savedFloor.getId()).isEqualTo(reusedId);
        assertThat(savedFloor.getCreatedAt()).isEqualTo(reusedFloor.getCreatedAt());
        assertThat(savedFloor.getLabel()).isEqualTo("2");

        verify(unitRepo).remapFloorId(eq(existingId), eq(reusedId), any(Instant.class));
        verify(commonAreaRepo).remapFloorId(eq(existingId), eq(reusedId), any(Instant.class));
        verify(entranceMatrixRepo).remapFloorId(eq(existingId), eq(reusedId), any(Instant.class));
        verify(floorRepo).deleteAllByIdInBatch(List.of(existingId));
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static ArgumentCaptor<List<FloorEntity>> floorListCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
