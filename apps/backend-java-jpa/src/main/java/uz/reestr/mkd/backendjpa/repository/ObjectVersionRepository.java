package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.ObjectVersion;

public interface ObjectVersionRepository extends JpaRepository<ObjectVersion, UUID> {

  List<ObjectVersion> findByEntityTypeAndEntityIdOrderByVersionNumberDesc(String entityType, UUID entityId);
}
