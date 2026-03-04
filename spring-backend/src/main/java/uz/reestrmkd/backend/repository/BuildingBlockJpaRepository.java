package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.BuildingBlockEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BuildingBlockJpaRepository extends JpaRepository<BuildingBlockEntity, UUID> {
    List<BuildingBlockEntity> findByBuildingIdIn(Collection<UUID> buildingIds);
    List<BuildingBlockEntity> findByBuildingId(UUID buildingId);
}
