package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.registry.model.BlockEngineeringEntity;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlockEngineeringJpaRepository extends JpaRepository<BlockEngineeringEntity, UUID> {
    Optional<BlockEngineeringEntity> findByBlockId(UUID blockId);
    List<BlockEngineeringEntity> findByBlockIdIn(Collection<UUID> blockIds);
}
