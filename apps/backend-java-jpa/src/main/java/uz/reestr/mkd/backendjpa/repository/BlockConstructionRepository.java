package uz.reestr.mkd.backendjpa.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.BlockConstructionEntity;

public interface BlockConstructionRepository extends JpaRepository<BlockConstructionEntity, UUID> {

  Optional<BlockConstructionEntity> findByBlockId(UUID blockId);
}
