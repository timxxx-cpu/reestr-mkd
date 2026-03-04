package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.CommonAreaEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CommonAreaJpaRepository extends JpaRepository<CommonAreaEntity, UUID> {
    List<CommonAreaEntity> findByFloorIdIn(Collection<UUID> floorIds);
}
