package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.FloorEntity;

import java.util.List;

public interface FloorRepository extends JpaRepository<FloorEntity, String> {
    List<FloorEntity> findByBlockIdIn(List<String> blockIds);

    List<FloorEntity> findByBlockId(String blockId);
}
