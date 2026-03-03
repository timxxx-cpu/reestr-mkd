package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.EntranceMatrixEntity;

import java.util.List;

public interface EntranceMatrixRepository extends JpaRepository<EntranceMatrixEntity, String> {
    List<EntranceMatrixEntity> findByBlockIdIn(List<String> blockIds);

    void deleteByBlockId(String blockId);

    void deleteByBlockIdAndFloorIdNotIn(String blockId, List<String> floorIds);
}
