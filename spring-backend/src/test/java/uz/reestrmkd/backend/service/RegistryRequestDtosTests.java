package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import uz.reestrmkd.backend.domain.registry.api.*;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RegistryRequestDtosTests {

    @Test
    void shouldResolveUnitsItemsWithPriority() {
        var dto = new BatchUpsertUnitsRequestDto(List.of(Map.of("u", 1)), List.of(Map.of("i", 2)));
        assertEquals(1, dto.resolveItems().size());
        assertEquals(1, dto.resolveItems().get(0).get("u"));
    }

    @Test
    void shouldResolveCommonAreasItemsFallback() {
        var dto = new BatchUpsertCommonAreasRequestDto(null, List.of(Map.of("m", 1)));
        assertEquals(1, dto.resolveItems().size());
        assertEquals(1, dto.resolveItems().get(0).get("m"));
    }

    @Test
    void shouldProvideSafeFloorDtos() {
        var single = new UpdateFloorRequestDto(null);
        assertTrue(single.safeUpdates().isEmpty());

        var batch = new UpdateFloorsBatchRequestDto(null, null);
        assertTrue(batch.safeItems().isEmpty());
        assertFalse(batch.safeStrict());
    }
    @Test
    void shouldProvideSafeCommonAndMatrixDtos() {
        var upsertCommon = new UpsertCommonAreaRequestDto(null);
        assertTrue(upsertCommon.safeData().isEmpty());

        var clear = new ClearCommonAreasRequestDto(null);
        assertEquals("", clear.safeFloorIds());

        var cell = new UpsertEntranceMatrixCellRequestDto(null);
        assertTrue(cell.safeData().isEmpty());

        var batch = new UpsertEntranceMatrixBatchRequestDto(null);
        assertTrue(batch.safeCells().isEmpty());
    }

    @Test
    void shouldMapExtensionDtosAndUpsertUnitSafeData() {
        var create = new CreateExtensionRequestDto("b", "L", null, null, 3, 1, null, null, null);
        assertEquals("b", create.toMap().get("buildingId"));
        assertEquals(3, create.toMap().get("floorsCount"));

        var update = new UpdateExtensionRequestDto("X", 5, null);
        assertEquals("X", update.toMap().get("label"));
        assertEquals(5, update.toMap().get("floorsCount"));

        var unit = new UpsertUnitRequestDto(null);
        assertTrue(unit.safeData().isEmpty());
    }

    @Test
    void shouldCreateExtensionCommandsFromDtos() {
        var create = new CreateExtensionRequestDto("b", "L", "ex", "mon", 3, 1, "anchor", "A1", "n");
        var createCmd = create.toCommand();
        assertEquals("b", createCmd.buildingId());
        assertEquals(3, createCmd.floorsCount());

        var update = new UpdateExtensionRequestDto("X", 5, 2);
        var updateCmd = update.toCommand();
        assertEquals("X", updateCmd.label());
        assertEquals(5, updateCmd.floorsCount());
    }

}
