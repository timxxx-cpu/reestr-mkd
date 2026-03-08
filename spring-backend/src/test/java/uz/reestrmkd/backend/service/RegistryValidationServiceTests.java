package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockConstructionJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BlockEngineeringJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.RegistryValidationService;
import uz.reestrmkd.backend.domain.registry.service.ValidationUtils;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistryValidationServiceTests {

    @Mock
    private BuildingJpaRepository buildingJpaRepository;
    @Mock
    private BuildingBlockJpaRepository buildingBlockJpaRepository;
    @Mock
    private BlockConstructionJpaRepository blockConstructionJpaRepository;
    @Mock
    private BlockEngineeringJpaRepository blockEngineeringJpaRepository;
    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;

    @InjectMocks
    private RegistryValidationService service;

    @Test
    void shouldReportMissingResidentialBuildingOnCompositionStep() {
        UUID projectId = UUID.randomUUID();
        BuildingEntity building = new BuildingEntity();
        building.setId(UUID.randomUUID());
        building.setProjectId(projectId);
        building.setLabel("Parking");
        building.setCategory("parking_separate");

        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(building));
        when(buildingBlockJpaRepository.findByBuildingIdIn(List.of(building.getId()))).thenReturn(List.of());
        when(blockConstructionJpaRepository.findByBlockIdIn(List.of())).thenReturn(List.of());
        when(blockEngineeringJpaRepository.findByBlockIdIn(List.of())).thenReturn(List.of());

        ValidationUtils.ValidationResult result = service.buildStepValidationResult(projectId, "composition");

        assertThat(result.ok()).isTrue();
        assertThat(result.errors()).extracting(ValidationUtils.ValidationError::code).contains("NO_RESIDENTIAL");
    }

    @Test
    void shouldReportDuplicateApartmentNumbers() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setProjectId(projectId);
        building.setLabel("House");
        building.setCategory("residential");

        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(blockId);
        block.setBuildingId(buildingId);
        block.setType("Р–");
        block.setLabel("A");

        FloorEntity floor = new FloorEntity();
        floor.setId(floorId);
        floor.setBlockId(blockId);
        floor.setLabel("1");
        floor.setIndex(1);

        UnitEntity unit1 = new UnitEntity();
        unit1.setId(UUID.randomUUID());
        unit1.setFloorId(floorId);
        unit1.setNumber("101");
        unit1.setUnitType("flat");

        UnitEntity unit2 = new UnitEntity();
        unit2.setId(UUID.randomUUID());
        unit2.setFloorId(floorId);
        unit2.setNumber("101");
        unit2.setUnitType("flat");

        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(building));
        when(buildingBlockJpaRepository.findByBuildingIdIn(List.of(buildingId))).thenReturn(List.of(block));
        when(blockConstructionJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of());
        when(blockEngineeringJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of());
        when(floorJpaRepository.findByBlockIdIn(List.of(blockId))).thenReturn(List.of(floor));
        when(unitJpaRepository.findByFloorIdIn(List.of(floorId))).thenReturn(List.of(unit1, unit2));

        ValidationUtils.ValidationResult result = service.buildStepValidationResult(projectId, "apartments");

        assertThat(result.ok()).isTrue();
        assertThat(result.errors()).extracting(ValidationUtils.ValidationError::code).contains("DUPLICATE_UNIT");
    }
}
