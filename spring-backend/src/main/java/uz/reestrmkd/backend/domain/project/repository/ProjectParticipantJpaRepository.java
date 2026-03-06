package uz.reestrmkd.backend.domain.project.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import uz.reestrmkd.backend.domain.project.model.ProjectParticipantEntity;

import java.util.List;
import java.util.UUID;

public interface ProjectParticipantJpaRepository extends JpaRepository<ProjectParticipantEntity, UUID> {
    List<ProjectParticipantEntity> findByProjectId(UUID projectId);
}
