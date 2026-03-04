package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.BlockFloorMarkerEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BlockFloorMarkerJpaRepository extends JpaRepository<BlockFloorMarkerEntity, UUID> {
    List<BlockFloorMarkerEntity> findByBlockIdIn(Collection<UUID> blockIds);
}
