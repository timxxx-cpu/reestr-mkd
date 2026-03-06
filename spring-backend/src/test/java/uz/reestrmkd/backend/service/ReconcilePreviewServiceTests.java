package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.ReconcilePreviewService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReconcilePreviewServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private ReconcilePreviewService service;

    @Test
    void shouldReturnZeroPreviewWhenNoFloors() {
        UUID blockId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(eq("select id from floors where block_id=?"), eq(blockId))).thenReturn(List.of());

        Map<String, Object> result = service.preview(blockId);

        @SuppressWarnings("unchecked")
        Map<String, Object> units = (Map<String, Object>) result.get("units");
        @SuppressWarnings("unchecked")
        Map<String, Object> common = (Map<String, Object>) result.get("commonAreas");
        assertThat(units).containsEntry("toRemove", 0).containsEntry("checkedCells", 0);
        assertThat(common).containsEntry("toRemove", 0).containsEntry("checkedCells", 0);
    }

    @Test
    void shouldCalculateUnitsAndCommonAreasToRemove() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();

        when(jdbcTemplate.queryForList(eq("select id from floors where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("id", floorId)));
        when(jdbcTemplate.queryForList(eq("select id, number from entrances where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("id", entranceId, "number", 1)));
        when(jdbcTemplate.queryForList(eq("select floor_id, entrance_number, flats_count, commercial_count, mop_count from entrance_matrix where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of(
                "floor_id", floorId,
                "entrance_number", 1,
                "flats_count", 1,
                "commercial_count", 0,
                "mop_count", 1
            )));
        when(jdbcTemplate.queryForList(contains("from units where floor_id in"), any(Object[].class)))
            .thenReturn(List.of(
                Map.of("id", UUID.randomUUID(), "floor_id", floorId, "entrance_id", entranceId, "unit_type", "flat", "created_at", "2024-01-01T00:00:00Z"),
                Map.of("id", UUID.randomUUID(), "floor_id", floorId, "entrance_id", entranceId, "unit_type", "flat", "created_at", "2024-01-02T00:00:00Z")
            ));
        when(jdbcTemplate.queryForList(contains("from common_areas where floor_id in"), any(Object[].class)))
            .thenReturn(List.of(
                Map.of("id", UUID.randomUUID(), "floor_id", floorId, "entrance_id", entranceId, "created_at", "2024-01-01T00:00:00Z"),
                Map.of("id", UUID.randomUUID(), "floor_id", floorId, "entrance_id", entranceId, "created_at", "2024-01-02T00:00:00Z")
            ));

        Map<String, Object> result = service.preview(blockId);

        @SuppressWarnings("unchecked")
        Map<String, Object> units = (Map<String, Object>) result.get("units");
        @SuppressWarnings("unchecked")
        Map<String, Object> common = (Map<String, Object>) result.get("commonAreas");

        assertThat(units).containsEntry("toRemove", 1).containsEntry("checkedCells", 1);
        assertThat(common).containsEntry("toRemove", 1).containsEntry("checkedCells", 1);
    }
}
