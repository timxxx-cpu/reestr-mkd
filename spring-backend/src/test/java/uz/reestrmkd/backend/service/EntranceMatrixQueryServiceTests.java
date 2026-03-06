package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixQueryService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EntranceMatrixQueryServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private EntranceMatrixQueryService service;

    @Test
    void shouldListMatrixRowsByBlock() {
        UUID blockId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(contains("from entrance_matrix"), eq(blockId)))
            .thenReturn(List.of(Map.of("entrance_number", 1)));

        List<Map<String, Object>> result = service.listByBlock(blockId);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst()).containsEntry("entrance_number", 1);
    }
}
