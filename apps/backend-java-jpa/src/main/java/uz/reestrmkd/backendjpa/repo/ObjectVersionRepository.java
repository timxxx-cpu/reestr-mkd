package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ObjectVersionEntity;

import java.util.List;

public interface ObjectVersionRepository extends JpaRepository<ObjectVersionEntity, String> {
    List<ObjectVersionEntity> findByEntityTypeAndEntityIdOrderByIdDesc(String entityType, String entityId);
}
