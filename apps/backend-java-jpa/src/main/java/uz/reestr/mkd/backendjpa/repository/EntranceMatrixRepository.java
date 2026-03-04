package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.EntranceMatrixEntity;

public interface EntranceMatrixRepository extends JpaRepository<EntranceMatrixEntity, UUID> {

  List<EntranceMatrixEntity> findByBlockBuildingProjectId(UUID projectId);
}
