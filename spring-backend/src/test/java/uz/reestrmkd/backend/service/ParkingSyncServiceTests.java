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
import uz.reestrmkd.backend.domain.registry.model.UnitType;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.ParkingSyncService;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ParkingSyncServiceTests {

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
    private ParkingSyncService parkingSyncService;

    @Test
    void shouldReturnZeroChangesWhenCurrentMatchesTarget() {
        UUID floorId = UUID.randomUUID();
        when(unitJpaRepository.findByFloorIdAndUnitTypeOrderByCreatedAtAscIdAsc(floorId, UnitType.PARKING_PLACE.value()))
            .thenReturn(List.of(unit(UUID.randomUUID(), "1", "UJ000001-ZP01-EP0001")));

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 1);

        assertThat(result.added()).isZero();
        assertThat(result.removed()).isZero();
        verify(unitJpaRepository, never()).saveAll(any());
        verify(unitJpaRepository, never()).deleteAllInBatch(any());
    }

    @Test
    void shouldAddParkingPlacesWhenTargetIsGreaterThanCurrent() {
        UUID floorId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();

        when(unitJpaRepository.findByFloorIdAndUnitTypeOrderByCreatedAtAscIdAsc(floorId, UnitType.PARKING_PLACE.value()))
            .thenReturn(List.of());
        when(floorJpaRepository.findById(floorId)).thenReturn(Optional.of(floor(floorId, blockId)));
        when(buildingBlockJpaRepository.findById(blockId)).thenReturn(Optional.of(block(blockId, buildingId)));
        when(buildingJpaRepository.findById(buildingId)).thenReturn(Optional.of(building(buildingId, projectId, "UJ000001-ZP01")));
        when(projectJpaRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, "UJ000001")));
        when(unitJpaRepository.findUnitCodesByBuildingIds(List.of(buildingId))).thenReturn(List.of());

        when(ujIdentifierService.getUnitPrefix("parking_place")).thenReturn("EP");
        when(ujIdentifierService.getNextSequenceNumber(List.of(), "UJ000001-ZP01-EP")).thenReturn(1);
        when(ujIdentifierService.generateUnitCode(eq("UJ000001-ZP01-EP"), eq(1))).thenReturn("UJ000001-ZP01-EP0001");
        when(ujIdentifierService.generateUnitCode(eq("UJ000001-ZP01-EP"), eq(2))).thenReturn("UJ000001-ZP01-EP0002");

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 2);

        assertThat(result.added()).isEqualTo(2);
        assertThat(result.removed()).isZero();

        ArgumentCaptor<List<UnitEntity>> captor = listCaptor();
        verify(unitJpaRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(2);
        assertThat(captor.getValue())
            .allSatisfy(unit -> {
                assertThat(unit.getFloorId()).isEqualTo(floorId);
                assertThat(unit.getUnitType()).isEqualTo(UnitType.PARKING_PLACE.value());
                assertThat(unit.getStatus()).isEqualTo("free");
                assertThat(unit.getHasMezzanine()).isFalse();
            });
        assertThat(captor.getValue()).extracting(UnitEntity::getUnitCode)
            .containsExactly("UJ000001-ZP01-EP0001", "UJ000001-ZP01-EP0002");
    }

    @Test
    void shouldRemoveHighestNumbersWhenTargetIsLowerThanCurrent() {
        UUID floorId = UUID.randomUUID();
        UnitEntity first = unit(UUID.randomUUID(), "1", "UJ000001-ZP01-EP0001");
        UnitEntity second = unit(UUID.randomUUID(), "3", "UJ000001-ZP01-EP0003");
        UnitEntity third = unit(UUID.randomUUID(), "2", "UJ000001-ZP01-EP0002");

        when(unitJpaRepository.findByFloorIdAndUnitTypeOrderByCreatedAtAscIdAsc(floorId, UnitType.PARKING_PLACE.value()))
            .thenReturn(List.of(first, second, third));

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 1);

        assertThat(result.added()).isZero();
        assertThat(result.removed()).isEqualTo(2);

        ArgumentCaptor<List<UnitEntity>> captor = listCaptor();
        verify(unitJpaRepository).deleteAllInBatch(captor.capture());
        assertThat(captor.getValue()).extracting(UnitEntity::getId)
            .containsExactly(second.getId(), third.getId());
    }

    @Test
    void shouldBackfillMissingCodesWhenCountMatchesTarget() {
        UUID floorId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UnitEntity missingCode = unit(UUID.randomUUID(), "1", "");

        when(unitJpaRepository.findByFloorIdAndUnitTypeOrderByCreatedAtAscIdAsc(floorId, UnitType.PARKING_PLACE.value()))
            .thenReturn(List.of(missingCode));
        when(floorJpaRepository.findById(floorId)).thenReturn(Optional.of(floor(floorId, blockId)));
        when(buildingBlockJpaRepository.findById(blockId)).thenReturn(Optional.of(block(blockId, buildingId)));
        when(buildingJpaRepository.findById(buildingId)).thenReturn(Optional.of(building(buildingId, projectId, "UJ000001-ZP01")));
        when(projectJpaRepository.findById(projectId)).thenReturn(Optional.of(project(projectId, "UJ000001")));
        when(unitJpaRepository.findUnitCodesByBuildingIds(List.of(buildingId)))
            .thenReturn(List.of(unitCodeRow(buildingId, "UJ000001-ZP01-EP0001")));
        when(ujIdentifierService.getUnitPrefix("parking_place")).thenReturn("EP");
        when(ujIdentifierService.getNextSequenceNumber(List.of("UJ000001-ZP01-EP0001"), "UJ000001-ZP01-EP"))
            .thenReturn(2);
        when(ujIdentifierService.generateUnitCode("UJ000001-ZP01-EP", 2)).thenReturn("UJ000001-ZP01-EP0002");

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 1);

        assertThat(result.added()).isZero();
        assertThat(result.removed()).isZero();
        verify(unitJpaRepository, times(1)).saveAll(List.of(missingCode));
        assertThat(missingCode.getUnitCode()).isEqualTo("UJ000001-ZP01-EP0002");
    }

    private UnitEntity unit(UUID id, String number, String unitCode) {
        UnitEntity entity = new UnitEntity();
        entity.setId(id);
        entity.setNumber(number);
        entity.setUnitCode(unitCode);
        entity.setUnitType(UnitType.PARKING_PLACE.value());
        return entity;
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

    private UnitJpaRepository.BuildingUnitCodeRow unitCodeRow(UUID buildingId, String unitCode) {
        return new UnitJpaRepository.BuildingUnitCodeRow() {
            @Override
            public UUID getBuildingId() {
                return buildingId;
            }

            @Override
            public String getUnitCode() {
                return unitCode;
            }
        };
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private ArgumentCaptor<List<UnitEntity>> listCaptor() {
        return ArgumentCaptor.forClass((Class) List.class);
    }
}
