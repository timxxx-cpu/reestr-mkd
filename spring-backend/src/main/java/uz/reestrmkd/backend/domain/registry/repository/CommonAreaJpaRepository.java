package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CommonAreaJpaRepository extends JpaRepository<CommonAreaEntity, UUID> {
    List<CommonAreaEntity> findByFloorIdIn(Collection<UUID> floorIds);
}
