package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BlockConstructionEntity;

import java.util.List;
import java.util.Optional;

public interface BlockConstructionRepository extends JpaRepository<BlockConstructionEntity, String> {
    Optional<BlockConstructionEntity> findByBlockId(String blockId);

    List<BlockConstructionEntity> findByBlockIdIn(List<String> blockIds);
}
