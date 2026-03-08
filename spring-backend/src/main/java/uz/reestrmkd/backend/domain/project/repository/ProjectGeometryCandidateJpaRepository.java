package uz.reestrmkd.backend.domain.project.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.project.model.ProjectGeometryCandidateEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectGeometryCandidateJpaRepository extends JpaRepository<ProjectGeometryCandidateEntity, UUID>, ProjectGeometryCandidateNativeRepository {
    List<ProjectGeometryCandidateEntity> findByProjectId(UUID projectId);
    List<ProjectGeometryCandidateEntity> findByProjectIdOrderBySourceIndexAscIdAsc(UUID projectId);
    Optional<ProjectGeometryCandidateEntity> findByIdAndProjectId(UUID id, UUID projectId);
    List<ProjectGeometryCandidateEntity> findByProjectIdAndAssignedBuildingIdAndIdNot(UUID projectId, UUID assignedBuildingId, UUID id);
}
