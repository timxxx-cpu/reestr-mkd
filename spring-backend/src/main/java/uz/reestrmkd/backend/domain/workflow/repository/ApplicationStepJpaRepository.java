package uz.reestrmkd.backend.domain.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import uz.reestrmkd.backend.domain.workflow.model.ApplicationStepEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationStepJpaRepository extends JpaRepository<ApplicationStepEntity, UUID> {
    Optional<ApplicationStepEntity> findByApplicationIdAndStepIndex(UUID applicationId, Integer stepIndex);
    List<ApplicationStepEntity> findByApplicationId(UUID applicationId);

    @Query(value = "select * from application_steps where application_id = ?1 order by step_index asc", nativeQuery = true)
    List<ApplicationStepEntity> findAllByApplicationOrdered(UUID applicationId);
}
