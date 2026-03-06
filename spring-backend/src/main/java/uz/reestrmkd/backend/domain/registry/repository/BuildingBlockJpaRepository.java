package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BuildingBlockJpaRepository extends JpaRepository<BuildingBlockEntity, UUID> {
    List<BuildingBlockEntity> findByBuildingIdIn(Collection<UUID> buildingIds);
    List<BuildingBlockEntity> findByBuildingId(UUID buildingId);
}
