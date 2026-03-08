package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.RegistryBlockUnitsQueryService;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistryBlockUnitsQueryServiceTests {

    @Mock
    private FloorJpaRepository floorJpaRepository;

    @Mock
    private EntranceJpaRepository entranceJpaRepository;

    @Mock
    private UnitJpaRepository unitJpaRepository;

    @InjectMocks
    private RegistryBlockUnitsQueryService service;

    @Test
    void shouldReturnUnitsAndEntranceMapForDefaultParams() {
        UUID blockId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();

        EntranceEntity entrance = new EntranceEntity();
        entrance.setId(entranceId);
        entrance.setNumber(2);

        when(unitJpaRepository.findBlockUnitRowsByBlockId(blockId))
            .thenReturn(List.of(blockUnitRow("1", "U-1", "flat", "Tower A", "10", "1", Instant.parse("2026-01-01T00:00:00Z"))));
        when(entranceJpaRepository.findByBlockIdInOrderByNumberAsc(eq(Set.of(blockId))))
            .thenReturn(List.of(entrance));

        Map<String, Object> result = service.loadUnits(blockId, null, null, null, null, null, null, null);

        assertThat(result).containsKeys("units", "entranceMap");
        assertThat((List<?>) result.get("units")).hasSize(1);
        @SuppressWarnings("unchecked")
        Map<String, Integer> entranceMap = (Map<String, Integer>) result.get("entranceMap");
        assertThat(entranceMap).containsEntry(entranceId.toString(), 2);

        verify(unitJpaRepository).findBlockUnitRowsByBlockId(blockId);
    }

    @Test
    void shouldApplySearchAndFilters() {
        UUID blockId = UUID.randomUUID();
        when(unitJpaRepository.findBlockUnitRowsByBlockIdOrFloorIdIn(eq(blockId), anyCollection())).thenReturn(List.of());
        when(floorJpaRepository.findAllById(anyIterable())).thenReturn(List.of());
        when(entranceJpaRepository.findByBlockIdInOrderByNumberAsc(anyCollection())).thenReturn(List.of());

        String floorIds = UUID.randomUUID() + "," + UUID.randomUUID();
        Map<String, Object> result = service.loadUnits(blockId, floorIds, "12", "flat", "A", "1", 2, 50);

        assertThat(result).containsKeys("units", "entranceMap");
        verify(unitJpaRepository).findBlockUnitRowsByBlockIdOrFloorIdIn(eq(blockId), anyCollection());
    }


    @Test
    void shouldIgnoreInvalidFloorIdsForJpaResolution() {
        UUID blockId = UUID.randomUUID();
        when(unitJpaRepository.findBlockUnitRowsByBlockId(blockId)).thenReturn(List.of());
        when(entranceJpaRepository.findByBlockIdInOrderByNumberAsc(anyCollection())).thenReturn(List.of());

        service.loadUnits(blockId, "bad-id,also-bad", null, null, null, null, null, null);

        verify(floorJpaRepository, never()).findAllById(anyIterable());
    }

    @Test
    void shouldResolveAdditionalEntranceBlocksByFloorIds() {
        UUID blockId = UUID.randomUUID();
        UUID relatedBlockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();

        FloorEntity floorEntity = new FloorEntity();
        floorEntity.setId(floorId);
        floorEntity.setBlockId(relatedBlockId);

        when(unitJpaRepository.findBlockUnitRowsByBlockIdOrFloorIdIn(eq(blockId), eq(List.of(floorId)))).thenReturn(List.of());
        when(floorJpaRepository.findAllById(eq(List.of(floorId)))).thenReturn(List.of(floorEntity));
        when(entranceJpaRepository.findByBlockIdInOrderByNumberAsc(argThat(ids -> ids.contains(blockId) && ids.contains(relatedBlockId))))
            .thenReturn(List.of());

        service.loadUnits(blockId, floorId.toString(), null, null, null, null, null, null);

        verify(entranceJpaRepository).findByBlockIdInOrderByNumberAsc(argThat(ids -> ids.contains(blockId) && ids.contains(relatedBlockId)));
    }

    private static UnitJpaRepository.BlockUnitRow blockUnitRow(
        String number,
        String unitCode,
        String unitType,
        String buildingLabel,
        String buildingHouseNumber,
        String floorLabel,
        Instant createdAt
    ) {
        return new UnitJpaRepository.BlockUnitRow() {
            private final UUID id = UUID.randomUUID();
            private final UUID floorId = UUID.randomUUID();

            @Override public UUID getId() { return id; }
            @Override public UUID getFloorId() { return floorId; }
            @Override public UUID getExtensionId() { return null; }
            @Override public UUID getEntranceId() { return null; }
            @Override public String getUnitCode() { return unitCode; }
            @Override public String getNumber() { return number; }
            @Override public String getUnitType() { return unitType; }
            @Override public Boolean getHasMezzanine() { return false; }
            @Override public String getMezzanineType() { return null; }
            @Override public java.math.BigDecimal getTotalArea() { return null; }
            @Override public java.math.BigDecimal getLivingArea() { return null; }
            @Override public java.math.BigDecimal getUsefulArea() { return null; }
            @Override public Integer getRoomsCount() { return null; }
            @Override public String getStatus() { return null; }
            @Override public String getCadastreNumber() { return null; }
            @Override public UUID getAddressId() { return null; }
            @Override public Instant getCreatedAt() { return createdAt; }
            @Override public Instant getUpdatedAt() { return null; }
            @Override public String getFloorLabel() { return floorLabel; }
            @Override public Integer getFloorIndex() { return 1; }
            @Override public String getBuildingLabel() { return buildingLabel; }
            @Override public String getBuildingHouseNumber() { return buildingHouseNumber; }
        };
    }
}
