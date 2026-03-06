package uz.reestrmkd.backend.domain.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.workflow.model.ApplicationHistoryEntity;

import java.util.List;
import java.util.UUID;

public interface ApplicationHistoryJpaRepository extends JpaRepository<ApplicationHistoryEntity, UUID> {
    List<ApplicationHistoryEntity> findByApplicationIdOrderByCreatedAtDesc(UUID applicationId);
}
