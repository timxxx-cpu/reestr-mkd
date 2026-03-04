package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.ObjectVersionEntity;

import java.util.List;
import java.util.UUID;

public interface ObjectVersionJpaRepository extends JpaRepository<ObjectVersionEntity, Long> {
    List<ObjectVersionEntity> findByEntityTypeAndEntityIdOrderByVersionNumberDesc(String entityType, UUID entityId);
}
