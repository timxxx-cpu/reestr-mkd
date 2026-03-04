package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.EntranceEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EntranceJpaRepository extends JpaRepository<EntranceEntity, UUID> {
    List<EntranceEntity> findByBlockIdIn(Collection<UUID> blockIds);
}
