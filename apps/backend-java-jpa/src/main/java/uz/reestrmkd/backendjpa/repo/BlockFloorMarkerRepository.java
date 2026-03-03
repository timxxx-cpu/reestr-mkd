package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BlockFloorMarkerEntity;

import java.util.List;

public interface BlockFloorMarkerRepository extends JpaRepository<BlockFloorMarkerEntity, String> {
    List<BlockFloorMarkerEntity> findByBlockIdIn(List<String> blockIds);

    void deleteByBlockId(String blockId);
}
