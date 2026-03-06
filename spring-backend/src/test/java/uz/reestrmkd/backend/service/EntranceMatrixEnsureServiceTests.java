package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixEnsureService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EntranceMatrixEnsureServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private EntranceMatrixEnsureService service;

    @BeforeEach
    void setUp() {
        service = new EntranceMatrixEnsureService(jdbcTemplate);
    }

    @Test
    void shouldDeleteMatrixWhenNoFloorsOrEntrances() {
        UUID blockId = UUID.randomUUID();

        when(jdbcTemplate.queryForList(eq("select id from floors where block_id=?"), eq(blockId)))
            .thenReturn(List.of());
        when(jdbcTemplate.queryForList(eq("select number from entrances where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("number", 1)));

        service.ensureForBlock(blockId);

        verify(jdbcTemplate).update("delete from entrance_matrix where block_id=?", blockId);
        verify(jdbcTemplate, never()).queryForList(startsWith("select id, floor_id"), any(Object[].class));
    }

    @Test
    void shouldDeleteStaleAndInsertMissingCells() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID staleFloorId = UUID.randomUUID();
        UUID staleId = UUID.randomUUID();

        when(jdbcTemplate.queryForList(eq("select id from floors where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("id", floorId)));
        when(jdbcTemplate.queryForList(eq("select number from entrances where block_id=?"), eq(blockId)))
            .thenReturn(List.of(Map.of("number", 1), Map.of("number", 2)));
        when(jdbcTemplate.queryForList(eq("select id, floor_id, entrance_number from entrance_matrix where block_id=?"), eq(blockId)))
            .thenReturn(List.of(
                Map.of("id", staleId, "floor_id", staleFloorId, "entrance_number", 1),
                Map.of("id", UUID.randomUUID(), "floor_id", floorId, "entrance_number", 1)
            ));

        service.ensureForBlock(blockId);

        verify(jdbcTemplate).update(eq("delete from entrance_matrix where id in (?)"), any(Object[].class));
        verify(jdbcTemplate).update(startsWith("insert into entrance_matrix"), eq(blockId), eq(floorId), eq(2));
    }
}
