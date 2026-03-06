package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.CommonAreasService;
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
class CommonAreasServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private CommonAreasService service;

    @Test
    void shouldInsertOnUpsertWhenNoId() {
        Map<String, Object> data = Map.of(
            "floorId", UUID.randomUUID().toString(),
            "entranceId", UUID.randomUUID().toString(),
            "type", "stairs",
            "area", "10.5",
            "height", "3.0"
        );

        service.upsert(data);

        verify(jdbcTemplate).update(startsWith("insert into common_areas"), any(), any(), eq("stairs"), any(), any());
    }

    @Test
    void shouldFailWhenTypeMissing() {
        Map<String, Object> data = Map.of(
            "floorId", UUID.randomUUID().toString(),
            "entranceId", UUID.randomUUID().toString(),
            "area", "10.5",
            "height", "3.0"
        );

        assertThatThrownBy(() -> service.upsert(data))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("type is required");
    }

    @Test
    void shouldBatchUpsertAndReturnCount() {
        List<Map<String, Object>> items = List.of(
            Map.of("floorId", UUID.randomUUID().toString(), "entranceId", UUID.randomUUID().toString(), "type", "a", "area", "1", "height", "2"),
            Map.of("floorId", UUID.randomUUID().toString(), "entranceId", UUID.randomUUID().toString(), "type", "b", "area", "1", "height", "2")
        );

        int count = service.batchUpsert(items);

        assertThat(count).isEqualTo(2);
        verify(jdbcTemplate, times(2)).update(startsWith("insert into common_areas"), any(), any(), any(), any(), any());
    }

    @Test
    void shouldListByBlockWhenNoFloorIds() {
        UUID blockId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(contains("join floors"), eq(blockId))).thenReturn(List.of(Map.of("id", UUID.randomUUID())));

        List<Map<String, Object>> result = service.list(blockId, null);

        assertThat(result).hasSize(1);
    }
}
