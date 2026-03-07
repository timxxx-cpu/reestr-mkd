package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.BlockExtensionEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockExtensionJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class BlockExtensionService {
    private final BlockExtensionJpaRepository extensionRepo;

    public BlockExtensionService(BlockExtensionJpaRepository extensionRepo) {
        this.extensionRepo = extensionRepo;
    }

    public List<BlockExtensionEntity> listByBlock(@NonNull UUID blockId) {
        return extensionRepo.findByParentBlockIdIn(List.of(blockId));
    }

    public BlockExtensionEntity create(@NonNull UUID blockId, CreateExtensionCommand command) {
        BlockExtensionEntity e = new BlockExtensionEntity();
        e.setId(UUID.randomUUID());
        e.setParentBlockId(blockId);
        e.setBuildingId(UUID.fromString(command.buildingId()));
        e.setLabel(command.label() == null ? "Пристройка" : command.label());
        e.setExtensionType(command.extensionType());
        e.setConstructionKind(command.constructionKind());
        e.setFloorsCount(command.floorsCount() == null ? 1 : command.floorsCount());
        e.setStartFloorIndex(command.startFloorIndex() == null ? 1 : command.startFloorIndex());
        e.setVerticalAnchorType(command.verticalAnchorType());
        e.setAnchorFloorKey(command.anchorFloorKey());
        e.setNotes(command.notes());
        e.setCreatedAt(Instant.now());
        e.setUpdatedAt(Instant.now());
        return extensionRepo.save(e);
    }

    public void update(@NonNull UUID extensionId, UpdateExtensionCommand command) {
        BlockExtensionEntity e = extensionRepo.findById(extensionId)
            .orElseThrow(() -> new ApiException("Extension not found", "NOT_FOUND", null, 404));
        if (command.label() != null) e.setLabel(command.label());
        if (command.floorsCount() != null) e.setFloorsCount(command.floorsCount());
        if (command.startFloorIndex() != null) e.setStartFloorIndex(command.startFloorIndex());
        e.setUpdatedAt(Instant.now());
        extensionRepo.save(e);
    }

    public void delete(@NonNull UUID extensionId) {
        extensionRepo.deleteById(extensionId);
    }
}