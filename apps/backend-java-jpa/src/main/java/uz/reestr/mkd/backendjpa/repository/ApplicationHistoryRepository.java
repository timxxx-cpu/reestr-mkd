package uz.reestr.mkd.backendjpa.repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.ApplicationHistoryEntity;

public interface ApplicationHistoryRepository extends JpaRepository<ApplicationHistoryEntity, UUID> {
}
