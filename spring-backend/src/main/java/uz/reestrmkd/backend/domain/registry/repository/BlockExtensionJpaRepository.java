package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.registry.model.BlockExtensionEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BlockExtensionJpaRepository extends JpaRepository<BlockExtensionEntity, UUID> {
    List<BlockExtensionEntity> findByParentBlockIdIn(Collection<UUID> parentBlockIds);
}
