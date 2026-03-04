package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.entity.ProjectParticipantEntity;

import java.util.List;
import java.util.UUID;

public interface ProjectParticipantJpaRepository extends JpaRepository<ProjectParticipantEntity, UUID> {
    List<ProjectParticipantEntity> findByProjectId(UUID projectId);
}
