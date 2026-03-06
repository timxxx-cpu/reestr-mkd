package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.MopsReconcileService;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MopsReconcileServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private MopsReconcileService service;

    @Test
    void shouldReturnZeroWhenNoFloors() {
        UUID blockId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(eq("select id from floors where block_id=?"), eq(blockId))).thenReturn(List.of());

        MopsReconcileService.MopsReconcileResult result = service.reconcile(blockId);

        assertThat(result.removed()).isZero();
        assertThat(result.checkedCells()).isZero();
    }

    @Test
    void shouldDeleteMopsAboveDesiredCount() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();
        UUID keepId = UUID.randomUUID();
        UUID deleteId = UUID.randomUUID();

        when(jdbcTemplate.queryForList(eq("select id from floors where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("id", floorId)));
        when(jdbcTemplate.queryForList(eq("select id, number from entrances where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("id", entranceId, "number", 1)));
        when(jdbcTemplate.queryForList(eq("select floor_id, entrance_number, mop_count from entrance_matrix where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("floor_id", floorId, "entrance_number", 1, "mop_count", 1)));

        Map<String, Object> row1 = new HashMap<>();
        row1.put("id", keepId);
        row1.put("floor_id", floorId);
        row1.put("entrance_id", entranceId);
        row1.put("created_at", Instant.parse("2024-01-01T00:00:00Z").toString());

        Map<String, Object> row2 = new HashMap<>();
        row2.put("id", deleteId);
        row2.put("floor_id", floorId);
        row2.put("entrance_id", entranceId);
        row2.put("created_at", Instant.parse("2024-01-02T00:00:00Z").toString());

        when(jdbcTemplate.queryForList(contains("from common_areas where floor_id in"), any(Object[].class)))
            .thenReturn(List.of(row1, row2));
        when(jdbcTemplate.update(startsWith("delete from common_areas where id in"), any(Object[].class))).thenReturn(1);

        MopsReconcileService.MopsReconcileResult result = service.reconcile(blockId);

        assertThat(result.checkedCells()).isEqualTo(1);
        assertThat(result.removed()).isEqualTo(1);
        verify(jdbcTemplate).update(startsWith("delete from common_areas where id in"), any(Object[].class));
    }
}
