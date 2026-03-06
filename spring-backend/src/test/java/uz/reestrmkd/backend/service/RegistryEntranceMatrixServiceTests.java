package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixQueryService;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixService;
import uz.reestrmkd.backend.domain.registry.service.RegistryEntranceMatrixService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistryEntranceMatrixServiceTests {

    @Mock private EntranceMatrixService entranceMatrixService;
    @Mock private EntranceMatrixQueryService entranceMatrixQueryService;

    private RegistryEntranceMatrixService service;

    @BeforeEach
    void setUp() {
        service = new RegistryEntranceMatrixService(entranceMatrixService, entranceMatrixQueryService);
    }

    @Test
    void shouldDelegateListByBlock() {
        UUID blockId = UUID.randomUUID();
        when(entranceMatrixQueryService.listByBlock(blockId)).thenReturn(List.of(Map.of("x", 1)));
        assertEquals(1, service.listByBlock(blockId).size());
    }

    @Test
    void shouldDelegateMutations() {
        UUID blockId = UUID.randomUUID();
        when(entranceMatrixService.upsertCell(blockId, Map.of("a", 1))).thenReturn(Map.of("ok", true));
        when(entranceMatrixService.upsertBatch(blockId, List.of(Map.of("b", 2)))).thenReturn(Map.of("count", 1));

        assertEquals(true, service.upsertCell(blockId, Map.of("a", 1)).get("ok"));
        assertEquals(1, service.upsertBatch(blockId, List.of(Map.of("b", 2))).get("count"));
    }
}
