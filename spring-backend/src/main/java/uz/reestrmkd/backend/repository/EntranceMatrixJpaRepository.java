package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.EntranceMatrixEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface EntranceMatrixJpaRepository extends JpaRepository<EntranceMatrixEntity, UUID> {
    List<EntranceMatrixEntity> findByBlockIdIn(Collection<UUID> blockIds);
}
