package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.ProjectDocumentEntity;

import java.util.List;
import java.util.UUID;

public interface ProjectDocumentJpaRepository extends JpaRepository<ProjectDocumentEntity, UUID> {
    List<ProjectDocumentEntity> findByProjectId(UUID projectId);
}
