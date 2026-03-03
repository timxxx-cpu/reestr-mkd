package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ApplicationHistoryEntity;

import java.util.List;

public interface ApplicationHistoryRepository extends JpaRepository<ApplicationHistoryEntity, String> {
    List<ApplicationHistoryEntity> findByApplicationIdOrderByCreatedAtDesc(String applicationId);
}
