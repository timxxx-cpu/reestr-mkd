package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.RoomEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface RoomJpaRepository extends JpaRepository<RoomEntity, UUID> {
    List<RoomEntity> findByUnit_IdIn(Collection<UUID> unitIds);
}
