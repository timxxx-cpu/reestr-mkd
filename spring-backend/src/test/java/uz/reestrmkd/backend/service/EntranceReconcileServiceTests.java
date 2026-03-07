package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.EntranceReconcileService;

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
class EntranceReconcileServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private EntranceReconcileService service;

    @Test
    void shouldCreateMissingEntrances() {
        UUID blockId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(contains("from entrances"), eq(blockId)))
            .thenReturn(List.of(Map.of("id", UUID.randomUUID(), "number", 1)));

        EntranceReconcileService.EntranceReconcileResult result = service.reconcile(blockId, 3);

        assertThat(result.count()).isEqualTo(3);
        assertThat(result.created()).isEqualTo(2);
        assertThat(result.deleted()).isZero();
        verify(jdbcTemplate, times(2)).update(startsWith("insert into entrances"), eq(blockId), anyInt());
    }

    @Test
    void shouldDeleteEntrancesAboveCount() {
        UUID blockId = UUID.randomUUID();
        UUID e1 = UUID.randomUUID();
        UUID e2 = UUID.randomUUID();
        UUID e3 = UUID.randomUUID();

        when(jdbcTemplate.queryForList(contains("from entrances"), eq(blockId)))
            .thenReturn(List.of(
                Map.of("id", e1, "number", 1),
                Map.of("id", e2, "number", 2),
                Map.of("id", e3, "number", 3)
            ));

        EntranceReconcileService.EntranceReconcileResult result = service.reconcile(blockId, 1);

        assertThat(result.count()).isEqualTo(1);
        assertThat(result.created()).isZero();
        assertThat(result.deleted()).isEqualTo(2);
        verify(jdbcTemplate).update(startsWith("delete from entrances where id in"), any(Object[].class));
    }
}
