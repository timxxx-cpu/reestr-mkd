package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.ApplicationLockEntity;

import java.util.Optional;
import java.util.UUID;

public interface ApplicationLockJpaRepository extends JpaRepository<ApplicationLockEntity, UUID> {
    Optional<ApplicationLockEntity> findByApplicationId(UUID applicationId);
}
