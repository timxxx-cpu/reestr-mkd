package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.FloorEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FloorJpaRepository extends JpaRepository<FloorEntity, UUID> {
    List<FloorEntity> findByBlockIdIn(Collection<UUID> blockIds);
}
