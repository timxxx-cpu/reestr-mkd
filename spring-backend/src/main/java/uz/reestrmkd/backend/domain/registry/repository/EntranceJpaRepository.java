package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EntranceJpaRepository extends JpaRepository<EntranceEntity, UUID> {
    List<EntranceEntity> findByBlockIdIn(Collection<UUID> blockIds);
    List<EntranceEntity> findByBlockIdOrderByNumberAsc(UUID blockId);
    List<EntranceEntity> findByBlockIdInOrderByNumberAsc(Collection<UUID> blockIds);
}
