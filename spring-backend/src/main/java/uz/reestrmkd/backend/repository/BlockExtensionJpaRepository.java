package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.BlockExtensionEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BlockExtensionJpaRepository extends JpaRepository<BlockExtensionEntity, UUID> {
    List<BlockExtensionEntity> findByParentBlockIdIn(Collection<UUID> parentBlockIds);
}
