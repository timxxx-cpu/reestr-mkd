package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ProjectParticipantEntity;

import java.util.List;

public interface ProjectParticipantRepository extends JpaRepository<ProjectParticipantEntity, String> {
    List<ProjectParticipantEntity> findByProjectId(String projectId);
}
