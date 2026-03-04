package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.EntranceEntity;

public interface EntranceRepository extends JpaRepository<EntranceEntity, UUID> {

  List<EntranceEntity> findByBlockBuildingProjectId(UUID projectId);
}
