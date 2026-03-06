package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.BlockStructureQueryService;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BlockStructureQueryServiceTests {

    @Mock
    private FloorJpaRepository floorJpaRepository;

    @Mock
    private EntranceJpaRepository entranceJpaRepository;

    private BlockStructureQueryService service;

    @BeforeEach
    void setUp() {
        service = new BlockStructureQueryService(floorJpaRepository, entranceJpaRepository);
    }

    @Test
    void shouldListFloorsByBlockViaJpa() {
        UUID blockId = UUID.randomUUID();
        FloorEntity floor = new FloorEntity();
        floor.setId(UUID.randomUUID());
        floor.setIndex(1);
        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of(floor));

        List<FloorEntity> result = service.listFloors(blockId);

        assertEquals(1, result.size());
        verify(floorJpaRepository).findByBlockIdOrderByIndexAsc(blockId);
    }

    @Test
    void shouldListEntrancesByBlockViaJpa() {
        UUID blockId = UUID.randomUUID();
        EntranceEntity entrance = new EntranceEntity();
        entrance.setId(UUID.randomUUID());
        entrance.setNumber(1);
        when(entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId)).thenReturn(List.of(entrance));

        List<EntranceEntity> result = service.listEntrances(blockId);

        assertEquals(1, result.size());
        assertEquals(1, result.getFirst().getNumber());
        verify(entranceJpaRepository).findByBlockIdOrderByNumberAsc(blockId);
    }
}
