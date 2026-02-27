package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ProjectEntity;

import java.util.List;

public interface ProjectRepository extends JpaRepository<ProjectEntity, String> {
    List<ProjectEntity> findByScopeIdOrderByIdDesc(String scopeId);
}
