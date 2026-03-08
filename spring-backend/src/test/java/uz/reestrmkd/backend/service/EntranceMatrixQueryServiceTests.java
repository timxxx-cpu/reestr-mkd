package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixQueryService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EntranceMatrixQueryServiceTests {

    @Mock
    private EntranceMatrixJpaRepository entranceMatrixJpaRepository;

    @InjectMocks
    private EntranceMatrixQueryService service;

    @Test
    void shouldListMatrixRowsByBlock() {
        UUID blockId = UUID.randomUUID();
        EntranceMatrixEntity entity = new EntranceMatrixEntity();
        entity.setId(UUID.randomUUID());
        entity.setBlockId(blockId);
        entity.setFloorId(UUID.randomUUID());
        entity.setEntranceNumber(1);
        when(entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId))
            .thenReturn(List.of(entity));

        List<Map<String, Object>> result = service.listByBlock(blockId);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst()).containsEntry("entrance_number", 1);
    }
}
