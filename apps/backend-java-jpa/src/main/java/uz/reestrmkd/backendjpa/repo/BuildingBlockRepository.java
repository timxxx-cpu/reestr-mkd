package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BuildingBlockEntity;

import java.util.List;

public interface BuildingBlockRepository extends JpaRepository<BuildingBlockEntity, String> {
    List<BuildingBlockEntity> findByBuildingIdIn(List<String> buildingIds);

    List<BuildingBlockEntity> findByBuildingIdInAndIsBasementBlockTrue(List<String> buildingIds);
}
