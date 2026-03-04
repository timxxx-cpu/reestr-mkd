package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.BlockConstructionEntity;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlockConstructionJpaRepository extends JpaRepository<BlockConstructionEntity, UUID> {
    Optional<BlockConstructionEntity> findByBlockId(UUID blockId);
    List<BlockConstructionEntity> findByBlockIdIn(Collection<UUID> blockIds);
}
