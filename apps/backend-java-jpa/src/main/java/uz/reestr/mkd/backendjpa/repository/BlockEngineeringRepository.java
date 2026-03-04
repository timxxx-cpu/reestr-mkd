package uz.reestr.mkd.backendjpa.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.BlockEngineeringEntity;

public interface BlockEngineeringRepository extends JpaRepository<BlockEngineeringEntity, UUID> {

  Optional<BlockEngineeringEntity> findByBlockId(UUID blockId);
}
