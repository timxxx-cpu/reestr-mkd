package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class EntranceMatrixServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private EntranceMatrixService service;

    @Test
    void shouldUpsertCellAndReturnRow() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        Map<String, Object> body = Map.of(
            "floorId", floorId,
            "entranceNumber", 1,
            "values", Map.of("flatsCount", 2)
        );
        when(jdbcTemplate.queryForList(contains("from entrance_matrix where block_id"), eq(blockId), eq(floorId), eq(1)))
            .thenReturn(List.of(Map.of("floor_id", floorId, "entrance_number", 1, "flats_count", 2)));

        Map<String, Object> result = service.upsertCell(blockId, body);

        assertThat(result).containsEntry("floor_id", floorId);
        verify(jdbcTemplate).update(startsWith("insert into entrance_matrix"), eq(blockId), eq(floorId), eq(1), eq(2), isNull(), isNull());
    }

    @Test
    void shouldFailWhenCellMissingRequiredFields() {
        UUID blockId = UUID.randomUUID();

        assertThatThrownBy(() -> service.upsertCell(blockId, Map.of()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("floorId and entranceNumber are required");
    }

    @Test
    void shouldUpsertBatchAndCollectFailures() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        List<Map<String, Object>> cells = List.of(
            Map.of("floorId", floorId, "entranceNumber", 1, "values", Map.of("flatsCount", 1)),
            Map.of("floorId", floorId, "values", Map.of("flatsCount", 1))
        );

        Map<String, Object> result = service.upsertBatch(blockId, cells);

        assertThat(result).containsEntry("updated", 1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> failed = (List<Map<String, Object>>) result.get("failed");
        assertThat(failed).hasSize(1);
        verify(jdbcTemplate, times(1)).update(startsWith("insert into entrance_matrix"), eq(blockId), eq(floorId), eq(1), eq(1), isNull(), isNull());
    }
}
