package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.CommonAreaEntity;

public interface CommonAreaRepository extends JpaRepository<CommonAreaEntity, UUID> {

  List<CommonAreaEntity> findByFloorBlockBuildingProjectId(UUID projectId);
}
