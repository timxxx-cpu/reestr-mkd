package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.UnitsReconcileService;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class UnitsReconcileServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private UnitsReconcileService service;

    @Test
    void shouldReturnZeroWhenNoFloors() {
        UUID blockId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(eq("select id from floors where block_id=?"), eq(blockId))).thenReturn(List.of());

        UnitsReconcileService.UnitsReconcileResult result = service.reconcile(blockId);

        assertThat(result.removed()).isZero();
        assertThat(result.added()).isZero();
        assertThat(result.checkedCells()).isZero();
    }

    @Test
    void shouldAddAndDeleteUnitsByMatrixTargets() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();
        UUID toDelete = UUID.randomUUID();

        when(jdbcTemplate.queryForList(eq("select id from floors where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("id", floorId)));
        when(jdbcTemplate.queryForList(eq("select id, number from entrances where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("id", entranceId, "number", 1)));
        when(jdbcTemplate.queryForList(eq("select floor_id, entrance_number, flats_count, commercial_count from entrance_matrix where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of(
                "floor_id", floorId,
                "entrance_number", 1,
                "flats_count", 2,
                "commercial_count", 0
            )));
        Map<String, Object> unitRow = new java.util.HashMap<>();
        unitRow.put("id", toDelete);
        unitRow.put("floor_id", floorId);
        unitRow.put("entrance_id", entranceId);
        unitRow.put("unit_type", "office");
        unitRow.put("cadastre_number", "");
        unitRow.put("total_area", null);
        unitRow.put("useful_area", null);
        unitRow.put("living_area", null);
        unitRow.put("created_at", Instant.now().toString());

        when(jdbcTemplate.queryForList(contains("from units where floor_id in"), any(Object[].class)))
            .thenReturn(List.of(unitRow));
        when(jdbcTemplate.update(startsWith("insert into units"), any(), any(), any(), any())).thenReturn(1);
        when(jdbcTemplate.update(startsWith("delete from units where id in"), any(Object[].class))).thenReturn(1);

        UnitsReconcileService.UnitsReconcileResult result = service.reconcile(blockId);

        assertThat(result.added()).isEqualTo(2);
        assertThat(result.removed()).isEqualTo(1);
        assertThat(result.checkedCells()).isEqualTo(1);

        verify(jdbcTemplate, times(2)).update(startsWith("insert into units"), eq(floorId), eq(entranceId), eq("flat"), eq("free"));
        verify(jdbcTemplate).update(startsWith("delete from units where id in"), any(Object[].class));
    }
}