package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BlockEngineeringEntity;

import java.util.List;
import java.util.Optional;

public interface BlockEngineeringRepository extends JpaRepository<BlockEngineeringEntity, String> {
    Optional<BlockEngineeringEntity> findByBlockId(String blockId);

    List<BlockEngineeringEntity> findByBlockIdIn(List<String> blockIds);
}
