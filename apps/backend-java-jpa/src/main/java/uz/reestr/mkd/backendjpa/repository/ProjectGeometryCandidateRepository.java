package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.ProjectGeometryCandidateEntity;

public interface ProjectGeometryCandidateRepository extends JpaRepository<ProjectGeometryCandidateEntity, UUID> {

  List<ProjectGeometryCandidateEntity> findByProjectIdOrderBySourceIndexAsc(UUID projectId);

  Optional<ProjectGeometryCandidateEntity> findByIdAndProjectId(UUID id, UUID projectId);

  Optional<ProjectGeometryCandidateEntity> findByProjectIdAndSourceIndex(UUID projectId, Integer sourceIndex);
}
