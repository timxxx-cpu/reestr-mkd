package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.BlockExtensionEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockExtensionJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.BlockExtensionService;
import uz.reestrmkd.backend.domain.registry.service.CreateExtensionCommand;
import uz.reestrmkd.backend.domain.registry.service.UpdateExtensionCommand;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class BlockExtensionServiceTests {

    @Mock
    private BlockExtensionJpaRepository extensionRepo;

    private BlockExtensionService service;

    @BeforeEach
    void setUp() {
        service = new BlockExtensionService(extensionRepo);
    }

    @Test
    void shouldListByBlock() {
        UUID blockId = UUID.randomUUID();
        when(extensionRepo.findByParentBlockIdIn(List.of(blockId))).thenReturn(List.of(new BlockExtensionEntity()));

        List<BlockExtensionEntity> result = service.listByBlock(blockId);

        assertEquals(1, result.size());
        verify(extensionRepo).findByParentBlockIdIn(List.of(blockId));
    }

    @Test
    void shouldCreateExtension() {
        UUID blockId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        when(extensionRepo.save(any(BlockExtensionEntity.class))).thenAnswer(i -> i.getArgument(0));

        BlockExtensionEntity result = service.create(blockId,
            new CreateExtensionCommand(buildingId.toString(), "A", null, null, null, null, null, null, null)
        );

        assertEquals(blockId, result.getParentBlockId());
        assertEquals(buildingId, result.getBuildingId());
        assertEquals("A", result.getLabel());
    }

    @Test
    void shouldUpdateExtension() {
        UUID extensionId = UUID.randomUUID();
        BlockExtensionEntity entity = new BlockExtensionEntity();
        entity.setId(extensionId);
        when(extensionRepo.findById(extensionId)).thenReturn(Optional.of(entity));

        service.update(extensionId, new UpdateExtensionCommand("New", null, null));

        assertEquals("New", entity.getLabel());
        verify(extensionRepo).save(entity);
    }

    @Test
    void shouldThrowWhenExtensionMissing() {
        UUID extensionId = UUID.randomUUID();
        when(extensionRepo.findById(extensionId)).thenReturn(Optional.empty());

        ApiException ex = assertThrows(ApiException.class, () -> service.update(extensionId, new UpdateExtensionCommand(null, null, null)));

        assertEquals("NOT_FOUND", ex.getCode());
    }

    @Test
    void shouldDeleteExtension() {
        UUID extensionId = UUID.randomUUID();
        service.delete(extensionId);
        verify(extensionRepo).deleteById(extensionId);
    }
}
