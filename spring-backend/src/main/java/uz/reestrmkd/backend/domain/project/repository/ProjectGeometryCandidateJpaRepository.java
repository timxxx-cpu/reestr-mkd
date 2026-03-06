package uz.reestrmkd.backend.domain.project.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.project.model.ProjectGeometryCandidateEntity;

import java.util.UUID;

public interface ProjectGeometryCandidateJpaRepository extends JpaRepository<ProjectGeometryCandidateEntity, UUID> {
}
