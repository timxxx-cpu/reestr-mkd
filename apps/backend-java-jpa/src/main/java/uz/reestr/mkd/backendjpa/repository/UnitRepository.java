package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.UnitEntity;

public interface UnitRepository extends JpaRepository<UnitEntity, UUID> {

  List<UnitEntity> findByBlockBuildingProjectId(UUID projectId);
}
