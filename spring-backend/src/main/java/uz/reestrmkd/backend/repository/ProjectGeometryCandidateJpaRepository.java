package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.ProjectGeometryCandidateEntity;

import java.util.UUID;

public interface ProjectGeometryCandidateJpaRepository extends JpaRepository<ProjectGeometryCandidateEntity, UUID> {
}
