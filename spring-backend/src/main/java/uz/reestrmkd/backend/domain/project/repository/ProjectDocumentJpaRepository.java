package uz.reestrmkd.backend.domain.project.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.project.model.ProjectDocumentEntity;

import java.util.List;
import java.util.UUID;

public interface ProjectDocumentJpaRepository extends JpaRepository<ProjectDocumentEntity, UUID> {
    List<ProjectDocumentEntity> findByProjectId(UUID projectId);
}
