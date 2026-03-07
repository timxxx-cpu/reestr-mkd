package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.FloorsUpdateService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class FloorsUpdateServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private FloorsUpdateService service;

    @Test
    void shouldUpdateSingleFloorAndReturnRow() {
        UUID floorId = UUID.randomUUID();
        when(jdbcTemplate.update(startsWith("update floors set"), any(), any(), any(), any(), any(), any(), any(), any(), eq(floorId)))
            .thenReturn(1);
        when(jdbcTemplate.queryForList(eq("select * from floors where id=?"), eq(floorId)))
            .thenReturn(List.of(Map.of("id", floorId, "label", "L")));

        Map<String, Object> result = service.updateFloor(floorId, Map.of("label", "L"));

        assertThat(result).containsEntry("id", floorId);
    }

    @Test
    void shouldFailSingleUpdateWhenNoUpdates() {
        assertThatThrownBy(() -> service.updateFloor(UUID.randomUUID(), Map.of()))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("updates are required");
    }

    @Test
    void shouldBatchUpdateWithFailedItems() {
        UUID floorId = UUID.randomUUID();
        List<Map<String, Object>> items = List.of(
            Map.of("id", floorId.toString(), "updates", Map.of("label", "X")),
            Map.of("id", UUID.randomUUID().toString(), "updates", Map.of("label", "Y")),
            Map.of("updates", Map.of("label", "Z"))
        );

        when(jdbcTemplate.queryForList(contains("select id from floors where id in"), any(Object[].class)))
            .thenReturn(List.of(Map.of("id", floorId)));

        Map<String, Object> result = service.updateFloorsBatch(items, false);

        assertThat(result).containsEntry("updated", 1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> failed = (List<Map<String, Object>>) result.get("failed");
        assertThat(failed).hasSize(2);
        verify(jdbcTemplate).update(startsWith("update floors set"), any(), any(), any(), any(), any(), any(), any(), any(), eq(floorId));
    }
}