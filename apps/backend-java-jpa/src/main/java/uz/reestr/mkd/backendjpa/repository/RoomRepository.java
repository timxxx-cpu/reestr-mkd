package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.RoomEntity;

public interface RoomRepository extends JpaRepository<RoomEntity, UUID> {

  List<RoomEntity> findByUnitIdOrderByCreatedAtAscIdAsc(UUID unitId);
}
