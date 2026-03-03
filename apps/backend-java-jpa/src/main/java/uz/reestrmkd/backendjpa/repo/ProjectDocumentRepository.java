package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ProjectDocumentEntity;

import java.util.List;

public interface ProjectDocumentRepository extends JpaRepository<ProjectDocumentEntity, String> {
    List<ProjectDocumentEntity> findByProjectIdOrderByDocDateDesc(String projectId);
}
