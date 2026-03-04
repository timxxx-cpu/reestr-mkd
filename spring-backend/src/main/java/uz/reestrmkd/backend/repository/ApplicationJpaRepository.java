package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestrmkd.backend.entity.ApplicationEntity;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationJpaRepository extends JpaRepository<ApplicationEntity, UUID> {

    @Query("select a from ApplicationEntity a where a.projectId = :projectId and a.scopeId = :scope")
    Optional<ApplicationEntity> findByProjectIdAndScopeId(@Param("projectId") UUID projectId, @Param("scope") String scope);

    @Modifying
    @Query("""
      update ApplicationEntity a
      set a.status = :status,
          a.workflowSubstatus = :workflowSubstatus,
          a.currentStep = :currentStep,
          a.currentStage = :currentStage,
          a.updatedAt = :updatedAt
      where a.id = :id
    """)
    int updateWorkflowState(
        @Param("id") UUID id,
        @Param("status") String status,
        @Param("workflowSubstatus") String workflowSubstatus,
        @Param("currentStep") Integer currentStep,
        @Param("currentStage") Integer currentStage,
        @Param("updatedAt") Instant updatedAt
    );
}
