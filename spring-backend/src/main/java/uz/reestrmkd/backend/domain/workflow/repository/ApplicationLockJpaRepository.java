package uz.reestrmkd.backend.domain.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.workflow.model.ApplicationLockEntity;

import java.util.Optional;
import java.util.UUID;

public interface ApplicationLockJpaRepository extends JpaRepository<ApplicationLockEntity, UUID> {
    Optional<ApplicationLockEntity> findByApplicationId(UUID applicationId);
}
