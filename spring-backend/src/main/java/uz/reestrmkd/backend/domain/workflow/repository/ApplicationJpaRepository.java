package uz.reestrmkd.backend.domain.workflow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApplicationJpaRepository extends JpaRepository<ApplicationEntity, UUID> {

    @Query("select a from ApplicationEntity a where a.projectId = :projectId and a.scopeId = :scope")
    Optional<ApplicationEntity> findByProjectIdAndScopeId(@Param("projectId") UUID projectId, @Param("scope") String scope);

    List<ApplicationEntity> findByScopeId(String scopeId);

    List<ApplicationEntity> findByScopeIdOrderByUpdatedAtDesc(String scopeId);

    List<ApplicationEntity> findByScopeIdAndAssigneeName(String scopeId, String assigneeName);

    List<ApplicationEntity> findByScopeIdAndAssigneeNameOrderByUpdatedAtDesc(String scopeId, String assigneeName);

    List<ApplicationEntity> findByExternalSourceIsNotNullOrderBySubmissionDateDesc();

    List<ApplicationEntity> findByExternalSourceIsNotNullAndScopeIdOrderBySubmissionDateDesc(String scopeId);

    Optional<ApplicationEntity> findFirstByProjectIdOrderByCreatedAtDesc(UUID projectId);

    Optional<ApplicationEntity> findFirstByProjectIdAndScopeIdOrderByCreatedAtDesc(UUID projectId, String scopeId);

    @Query("""
        select count(a)
        from ApplicationEntity a
        where a.scopeId = :scope
          and a.status = 'IN_PROGRESS'
          and a.projectId in (
              select p.id
              from ProjectEntity p
              where p.cadastreNumber = :cadastreNumber
          )
    """)
    long countInProgressByScopeIdAndCadastreNumber(
        @Param("scope") String scope,
        @Param("cadastreNumber") String cadastreNumber
    );

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
