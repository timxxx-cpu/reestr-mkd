package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.project.service.ProjectBuildingDetailsPersistenceService;
import uz.reestrmkd.backend.domain.registry.model.BlockConstructionEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockEngineeringEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockConstructionJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BlockEngineeringJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectBuildingDetailsPersistenceServiceTests {

    @Mock
    private BuildingBlockJpaRepository buildingBlockJpaRepository;
    @Mock
    private BlockConstructionJpaRepository blockConstructionJpaRepository;
    @Mock
    private BlockEngineeringJpaRepository blockEngineeringJpaRepository;

    @Test
    void shouldCreateBasementBlockViaJpa() {
        ProjectBuildingDetailsPersistenceService service = service();
        UUID buildingId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        Map<String, Object> geometry = Map.of("type", "MultiPolygon");

        when(buildingBlockJpaRepository.findById(blockId)).thenReturn(Optional.empty());
        when(buildingBlockJpaRepository.save(any(BuildingBlockEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.saveBasementBlock(
            buildingId,
            blockId,
            "Basement 1",
            List.of(UUID.randomUUID()),
            2,
            true,
            Map.of("1", true),
            Map.of("water", true),
            3,
            geometry
        );

        ArgumentCaptor<BuildingBlockEntity> captor = ArgumentCaptor.forClass(BuildingBlockEntity.class);
        verify(buildingBlockJpaRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(blockId);
        assertThat(captor.getValue().getBuildingId()).isEqualTo(buildingId);
        assertThat(captor.getValue().getIsBasementBlock()).isTrue();
        assertThat(captor.getValue().getBasementDepth()).isEqualTo(2);
        assertThat(captor.getValue().getEntrancesCount()).isEqualTo(3);
        assertThat(captor.getValue().getFootprintGeojson()).isEqualTo(geometry);
    }

    @Test
    void shouldUpdateBlockConstructionAndEngineeringViaJpa() {
        ProjectBuildingDetailsPersistenceService service = service();
        UUID blockId = UUID.randomUUID();

        when(blockConstructionJpaRepository.findByBlockId(blockId)).thenReturn(Optional.empty());
        when(blockEngineeringJpaRepository.findByBlockId(blockId)).thenReturn(Optional.empty());
        when(blockConstructionJpaRepository.save(any(BlockConstructionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(blockEngineeringJpaRepository.save(any(BlockEngineeringEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.upsertBlockConstruction(blockId, "pile", "brick", "monolith", "flat", 8);
        service.upsertBlockEngineering(blockId, true, true, false, true, false, true, true, false, true, false, true, false);

        ArgumentCaptor<BlockConstructionEntity> constructionCaptor = ArgumentCaptor.forClass(BlockConstructionEntity.class);
        verify(blockConstructionJpaRepository).save(constructionCaptor.capture());
        assertThat(constructionCaptor.getValue().getBlockId()).isEqualTo(blockId);
        assertThat(constructionCaptor.getValue().getFoundation()).isEqualTo("pile");
        assertThat(constructionCaptor.getValue().getSeismicity()).isEqualTo(8);

        ArgumentCaptor<BlockEngineeringEntity> engineeringCaptor = ArgumentCaptor.forClass(BlockEngineeringEntity.class);
        verify(blockEngineeringJpaRepository).save(engineeringCaptor.capture());
        assertThat(engineeringCaptor.getValue().getBlockId()).isEqualTo(blockId);
        assertThat(engineeringCaptor.getValue().getHasElectricity()).isTrue();
        assertThat(engineeringCaptor.getValue().getHasHeating()).isTrue();
        assertThat(engineeringCaptor.getValue().getHasSolarPanels()).isFalse();
    }

    private ProjectBuildingDetailsPersistenceService service() {
        return new ProjectBuildingDetailsPersistenceService(
            buildingBlockJpaRepository,
            blockConstructionJpaRepository,
            blockEngineeringJpaRepository
        );
    }
}
