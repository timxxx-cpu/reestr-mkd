package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.registry.model.RoomEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface RoomJpaRepository extends JpaRepository<RoomEntity, UUID> {
    List<RoomEntity> findByUnit_IdIn(Collection<UUID> unitIds);
}
