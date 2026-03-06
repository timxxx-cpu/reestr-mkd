package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.service.CommonAreasService;
import uz.reestrmkd.backend.domain.registry.service.RegistryCommonAreasService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistryCommonAreasServiceTests {

    @Mock private CommonAreasService commonAreasService;

    private RegistryCommonAreasService service;

    @BeforeEach
    void setUp() {
        service = new RegistryCommonAreasService(commonAreasService);
    }

    @Test
    void shouldDelegateUpsert() {
        service.upsert(Map.of("k", "v"));
        verify(commonAreasService).upsert(Map.of("k", "v"));
    }

    @Test
    void shouldDelegateBatchUpsert() {
        when(commonAreasService.batchUpsert(List.of(Map.of("a", 1)))).thenReturn(2);
        assertEquals(2, service.batchUpsert(List.of(Map.of("a", 1))));
    }

    @Test
    void shouldDelegateDeleteClearAndList() {
        UUID id = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        when(commonAreasService.list(blockId, "1,2")).thenReturn(List.of(Map.of("id", id)));

        service.delete(id);
        service.clear(blockId, "1,2");
        var list = service.list(blockId, "1,2");

        verify(commonAreasService).delete(id);
        verify(commonAreasService).clear(blockId, "1,2");
        assertEquals(1, list.size());
    }
}
