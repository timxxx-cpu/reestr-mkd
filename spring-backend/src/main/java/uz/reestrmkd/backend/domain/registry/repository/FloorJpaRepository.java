package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.registry.model.FloorEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FloorJpaRepository extends JpaRepository<FloorEntity, UUID> {
    List<FloorEntity> findByBlockIdIn(Collection<UUID> blockIds);
}
