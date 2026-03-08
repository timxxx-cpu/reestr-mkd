package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.common.service.UjIdentifierService;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.UnitService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class UnitServiceTests {

    @Mock
    private UnitJpaRepository unitJpaRepository;
    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private BuildingBlockJpaRepository buildingBlockJpaRepository;
    @Mock
    private BuildingJpaRepository buildingJpaRepository;
    @Mock
    private ProjectJpaRepository projectJpaRepository;
    @Mock
    private UjIdentifierService ujIdentifierService;

    @InjectMocks
    private UnitService unitService;

    @Test
    void shouldDefaultLegacyNullHasMezzanineToFalseOnPatchUpdate() {
        UUID unitId = UUID.randomUUID();
        UnitEntity existing = new UnitEntity();
        existing.setId(unitId);
        existing.setFloorId(UUID.randomUUID());
        existing.setUnitType("parking_place");
        existing.setHasMezzanine(null);

        when(unitJpaRepository.findById(unitId)).thenReturn(Optional.of(existing));
        when(unitJpaRepository.save(any(UnitEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UUID savedId = unitService.upsertUnit(Map.of(
            "id", unitId,
            "num", "-P1",
            "area", "13.25"
        ));

        assertThat(savedId).isEqualTo(unitId);
        assertThat(existing.getHasMezzanine()).isFalse();
        assertThat(existing.getNumber()).isEqualTo("-P1");
        assertThat(existing.getTotalArea()).isEqualByComparingTo(new BigDecimal("13.25"));
    }

    @Test
    void shouldBatchUpsertUnitsViaRepositoriesAndGenerateUnitCode() {
        UUID floorId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();

        when(floorJpaRepository.findAllById(List.of(floorId))).thenReturn(List.of(floor(floorId, blockId)));
        when(buildingBlockJpaRepository.findAllById(List.of(blockId))).thenReturn(List.of(block(blockId, buildingId)));
        when(buildingJpaRepository.findAllById(List.of(buildingId))).thenReturn(List.of(building(buildingId, projectId, "UJ000001-ZM01")));
        when(projectJpaRepository.findAllById(List.of(projectId))).thenReturn(List.of(project(projectId, "UJ000001")));
        when(unitJpaRepository.findUnitNumberConflicts(any(), any())).thenReturn(List.of());
        when(unitJpaRepository.findAllById(any())).thenReturn(List.of());
        when(unitJpaRepository.findUnitCodesByBuildingIds(any())).thenReturn(List.of());
        when(ujIdentifierService.getUnitPrefix("flat")).thenReturn("KV");
        when(ujIdentifierService.getNextSequenceNumber(List.of(), "UJ000001-ZM01-KV")).thenReturn(38);
        when(ujIdentifierService.generateUnitCode("UJ000001-ZM01-KV", 38)).thenReturn("UJ000001-ZM01-KV0038");

        int updated = unitService.batchUpsertUnits(List.of(Map.of(
            "floorId", floorId,
            "num", "42",
            "type", "flat",
            "area", "65.5",
            "rooms", 3
        )));

        assertThat(updated).isEqualTo(1);

        ArgumentCaptor<List<UnitEntity>> captor = listCaptor();
        verify(unitJpaRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);

        UnitEntity saved = captor.getValue().getFirst();
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getFloorId()).isEqualTo(floorId);
        assertThat(saved.getNumber()).isEqualTo("42");
        assertThat(saved.getUnitType()).isEqualTo("flat");
        assertThat(saved.getTotalArea()).isEqualByComparingTo(new BigDecimal("65.5"));
        assertThat(saved.getRoomsCount()).isEqualTo(3);
        assertThat(saved.getStatus()).isEqualTo("free");
        assertThat(saved.getHasMezzanine()).isFalse();
        assertThat(saved.getUnitCode()).isEqualTo("UJ000001-ZM01-KV0038");
    }

    private FloorEntity floor(UUID floorId, UUID blockId) {
        FloorEntity entity = new FloorEntity();
        entity.setId(floorId);
        entity.setBlockId(blockId);
        return entity;
    }

    private BuildingBlockEntity block(UUID blockId, UUID buildingId) {
        BuildingBlockEntity entity = new BuildingBlockEntity();
        entity.setId(blockId);
        entity.setBuildingId(buildingId);
        return entity;
    }

    private BuildingEntity building(UUID buildingId, UUID projectId, String buildingCode) {
        BuildingEntity entity = new BuildingEntity();
        entity.setId(buildingId);
        entity.setProjectId(projectId);
        entity.setBuildingCode(buildingCode);
        return entity;
    }

    private ProjectEntity project(UUID projectId, String ujCode) {
        ProjectEntity entity = new ProjectEntity();
        entity.setId(projectId);
        entity.setUjCode(ujCode);
        return entity;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<List<UnitEntity>> listCaptor() {
        return ArgumentCaptor.forClass((Class) List.class);
    }
}
