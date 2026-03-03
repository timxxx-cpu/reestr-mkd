package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.RoomEntity;

import java.util.List;

public interface RoomRepository extends JpaRepository<RoomEntity, String> {
    List<RoomEntity> findByUnitIdIn(List<String> unitIds);
}
