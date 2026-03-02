package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ApplicationEntity;

import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<ApplicationEntity, String> {
    List<ApplicationEntity> findByScopeIdOrderByIdDesc(String scopeId);
    Optional<ApplicationEntity> findFirstByProjectIdAndScopeId(String projectId, String scopeId);
    Optional<ApplicationEntity> findFirstByProjectId(String projectId);
}
