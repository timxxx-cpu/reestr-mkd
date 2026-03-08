package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.BasementService;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BasementServiceTests {

    @Mock
    private BuildingJpaRepository buildingJpaRepository;
    @Mock
    private BuildingBlockJpaRepository buildingBlockJpaRepository;
    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;

    @InjectMocks
    private BasementService service;

    @Test
    void shouldReturnProjectBasementsMapped() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID basementId = UUID.randomUUID();
        UUID linkedBlockId = UUID.randomUUID();

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);

        BuildingBlockEntity basement = new BuildingBlockEntity();
        basement.setId(basementId);
        basement.setBuildingId(buildingId);
        basement.setIsBasementBlock(true);
        basement.setLinkedBlockIds(new UUID[]{linkedBlockId});
        basement.setBasementDepth(2);
        basement.setBasementHasParking(true);
        basement.setBasementParkingLevels(Map.of("1", true));
        basement.setBasementCommunications(Map.of("electricity", true));
        basement.setEntrancesCount(3);
        basement.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));

        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(building));
        when(buildingBlockJpaRepository.findByBuildingIdIn(List.of(buildingId))).thenReturn(List.of(basement));

        List<Map<String, Object>> result = service.getProjectBasements(projectId);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst())
            .containsEntry("id", basementId.toString())
            .containsEntry("buildingId", buildingId.toString())
            .containsEntry("blockId", linkedBlockId.toString())
            .containsEntry("depth", 2)
            .containsEntry("hasParking", true);
    }

    @Test
    void shouldToggleBasementLevelAndDeleteParkingUnitsWhenDisabled() {
        UUID basementId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();

        BuildingBlockEntity basement = new BuildingBlockEntity();
        basement.setId(basementId);
        basement.setIsBasementBlock(true);
        basement.setBasementDepth(2);
        basement.setBasementParkingLevels(new LinkedHashMap<>(Map.of("1", true)));

        FloorEntity floor = new FloorEntity();
        floor.setId(floorId);

        when(buildingBlockJpaRepository.findById(basementId)).thenReturn(Optional.of(basement));
        when(floorJpaRepository.findByBlockIdAndIndex(basementId, -2)).thenReturn(List.of(floor));

        service.toggleBasementLevel(basementId, 2, false);

        assertThat(basement.getBasementParkingLevels()).containsEntry("2", false);
        verify(buildingBlockJpaRepository).save(basement);
        verify(unitJpaRepository).deleteByFloorIdAndUnitType(floorId, "parking_place");
    }

    @Test
    void shouldRejectLevelOutsideBasementDepth() {
        UUID basementId = UUID.randomUUID();

        BuildingBlockEntity basement = new BuildingBlockEntity();
        basement.setId(basementId);
        basement.setIsBasementBlock(true);
        basement.setBasementDepth(1);

        when(buildingBlockJpaRepository.findById(basementId)).thenReturn(Optional.of(basement));

        assertThatThrownBy(() -> service.toggleBasementLevel(basementId, 2, true))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("level must be <= basement depth");

        verify(buildingBlockJpaRepository, never()).save(any());
        verify(unitJpaRepository, never()).deleteByFloorIdAndUnitType(any(), eq("parking_place"));
    }
}
